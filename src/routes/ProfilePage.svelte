<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import Twynt from './Twynt.svelte';
	import Avatar from './Avatar.svelte';
	import { Button } from '@/components/ui/button';
	import { Label } from '@/components/ui/label';
	import { Brain, Calendar } from 'lucide-svelte';
	import { Separator } from '@/components/ui/separator';
	import FollowListPopup from './FollowListPopup.svelte';
	import ProfileSettings from './ProfileSettings.svelte';
	import ProfileButton from './ProfileButton.svelte';
	import * as Tooltip from '@/components/ui/tooltip';
	import { mode } from 'mode-watcher';
	import { cdnUrl } from './stores';
	import TopTab from './TopTab.svelte';

	export let profileHandle: string;
	export let handletwyntClick: (id: string) => Promise<void>;
	export let myId: string;

	interface ProfileData {
		username: string;
		handle: string;
		iq: number;
		created_at: string;
		id: string;
		following: number;
		followers: number;
		bio: string;
		verified: boolean;
	}

	interface TwyntData {
		id: string;
		content: string;
		userId: string;
		created_at: string;
		likes: number;
		retwynts: number;
		replies: number;
		liked: boolean;
		retwynted: boolean;
	}

	interface TwyntResponse {
		twynts: TwyntData[];
	}

	let profile: ProfileData | null = null;
	let usertwynts: TwyntResponse | null = null;
	let loading = true;
	let isSelf = false;
	let isFollowing = false;
	let isFollowedBy = false;
	let followersCount = 0;
	let followingCount = 0;
	let avatar = '';

	let showFollowersPopup = false;
	let showFollowingPopup = false;

	let currentTab = 'twynts';
	const tabs = ['twynts', 'Likes'];

	function handleTabChange(tab: string) {
		currentTab = tab;
		fetchUsertwynts(currentTab === tabs[1]);
	}

	function toggleFollowersPopup() {
		showFollowersPopup = !showFollowersPopup;
	}

	function toggleFollowingPopup() {
		showFollowingPopup = !showFollowingPopup;
	}

	async function fetchProfile() {
		try {
			const response = await fetch(`/api/profile?handle=${profileHandle}`);

			if (response.status === 200) {
				const profileData = await response.json();
				profile = profileData;
				isSelf = profileData.id === myId;
				avatar = cdnUrl(profileData.id, 'big');
			} else {
				toast(`Failed to load profile. Error: ${response.status}`);
			}
		} catch (error) {
			if (isSelf) return;
			console.error('Error fetching profile:', error);
			toast('Failed to load profile');
		}
	}

	async function fetchUsertwynts(fetchLikes: boolean) {
		try {
			const response = await fetch(
				`/api/feed?handle=${profileHandle}${fetchLikes ? '&type=Liked' : ''}`
			);

			if (response.status === 200) {
				usertwynts = await response.json();
			} else {
				toast(`Failed to load user twynts. Error: ${response.status}`);
			}
		} catch (error) {
			if (isSelf) return;
			console.error('Error fetching user twynts:', error);
			toast('Failed to load user twynts');
		}
	}

	async function toggleFollow() {
		if (!profile) return;

		try {
			const response = await fetch('/api/follow', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ userId: profile.id })
			});

			if (response.ok) {
				isFollowing = !isFollowing;
				followersCount += isFollowing ? 1 : -1;
			} else if (response.status === 409) {
				isSelf = true;
			} else {
				const error = await response.json();
				toast(error.error);
			}
		} catch (error) {
			if (isSelf) return;
			console.error('Error toggling follow:', error);
			toast('Failed to update follow status');
		}
	}

	async function checkFollowStatus() {
		if (!profile) return;

		try {
			const response = await fetch(`/api/follow?userId=${profile.id}`);
			if (response.ok) {
				const result = await response.json();
				isFollowing = result.isFollowing;
				isFollowedBy = result.isFollowedBy;
			} else if (response.status === 409) {
				isSelf = true;
			} else {
				const error = await response.json();
				toast(error.error);
			}
		} catch (error) {
			if (isSelf) return;
			console.error('Error checking follow status:', error);
			toast('Failed to check follow status');
		}
	}

	async function fetchFollowCounts() {
		if (!profile) return;

		try {
			const followersResponse = await fetch(
				`/api/followlist?userId=${profile.id}&type=followers&page=1`
			);
			const followingResponse = await fetch(
				`/api/followlist?userId=${profile.id}&type=following&page=1`
			);

			if (followersResponse.ok && followingResponse.ok) {
				const followersData = await followersResponse.json();
				const followingData = await followingResponse.json();
				followersCount = parseInt(followersData.totalCount);
				followingCount = parseInt(followingData.totalCount);
			} else {
				toast('Failed to fetch follow counts');
			}
		} catch (error) {
			if (isSelf) return;
			console.error('Error fetching follow counts:', error);
			toast('Failed to fetch follow counts');
		}
	}

	onMount(async () => {
		await fetchProfile();
		if (profile) {
			await Promise.all([fetchUsertwynts(false), checkFollowStatus(), fetchFollowCounts()]);
		}
		loading = false;
	});
</script>

{#if loading}
	<LoadingSpinner />
{:else if profile}
	<div class="h-full w-full flex-grow overflow-hidden pl-1">
		<div class="mr-[-17px] h-full overflow-y-auto overflow-x-hidden pr-[17px]">
			<div class="mt-2">
				<div class="flex items-center justify-between px-2">
					<div class="flex items-center gap-4">
						<Avatar size={40} src={avatar} alt={profile.username} border={true} />
						<div class="flex flex-col gap-2">
							<div class="inline-flex items-center gap-2">
								<Label class="text-2xl font-bold text-primary">{profile.username}</Label>
								{#if profile.verified}
									<Tooltip.Root>
										<Tooltip.Trigger>
											<div class="flex h-full w-7 items-center">
												<img
													class="h-7 w-7"
													src={$mode !== 'light' ? 'white_mode_verified.png' : 'verified.png'}
													alt="This user is verified."
												/>
											</div>
										</Tooltip.Trigger>
										<Tooltip.Content>
											<p>This user is <span class="rounded-xl bg-border p-1">verified</span>.</p>
										</Tooltip.Content>
									</Tooltip.Root>
								{/if}
							</div>
							<p class="text-xl text-muted-foreground">@{profile.handle}</p>
							<div class="w-24">
								{#if isSelf}
									<ProfileSettings
										userId={profile.id}
										username={profile.username}
										bio={profile.bio}
									/>
								{:else}
									<Button class="w-full" on:click={toggleFollow}>
										{isFollowing ? 'Unfollow' : 'Follow'}
									</Button>
								{/if}
							</div>
							{#if isFollowedBy}
								<p class="text-sm text-muted-foreground">Follows you</p>
							{/if}
						</div>
					</div>
					<div class="md:hidden {!isSelf ? 'hidden' : ''}">
						<ProfileButton />
					</div>
				</div>

				<div class="mt-4 inline-flex gap-4">
					<button
						type="button"
						class="cursor-pointer border-none bg-transparent p-0 font-bold text-primary hover:underline"
						on:click={toggleFollowingPopup}
						on:keydown={(e) => e.key === 'Enter' && toggleFollowingPopup()}
						aria-label="Show following list"
					>
						{followingCount.toLocaleString()} following
					</button>
					<button
						type="button"
						class="cursor-pointer border-none bg-transparent p-0 font-bold text-primary hover:underline"
						on:click={toggleFollowersPopup}
						on:keydown={(e) => e.key === 'Enter' && toggleFollowersPopup()}
						aria-label="Show followers list"
					>
						{followersCount.toLocaleString()} followers
					</button>
				</div>

				<FollowListPopup
					userId={profile.id}
					type="following"
					isOpen={showFollowingPopup}
					onClose={toggleFollowingPopup}
				/>

				<FollowListPopup
					userId={profile.id}
					type="followers"
					isOpen={showFollowersPopup}
					onClose={toggleFollowersPopup}
				/>

				<blockquote
					class="my-4 flex flex-col gap-2 border-s-4 border-muted-foreground bg-border p-4"
				>
					<Label class="text-lg font-bold text-primary">About me</Label>
					<p>
						{profile.bio}
					</p>

					<div class="flex items-center justify-between">
						<div
							class="flex select-none items-center gap-2 rounded-xl border border-transparent bg-primary px-1.5 py-0.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							<Brain />
							<span>{profile.iq}</span>
						</div>
						<div
							class="inline-flex select-none items-center gap-2 rounded-xl border border-transparent bg-primary px-1.5 py-0.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							<Calendar />
							<p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
						</div>
					</div>
				</blockquote>
			</div>

			<div class="flex max-w-[600px] flex-col gap-3">
				<Separator class="mt-3" />
				<TopTab {tabs} {currentTab} onTabChange={handleTabChange} />
				<Separator />
				{#if !usertwynts?.twynts?.length}
					<p>No twynts yet.</p>
				{:else}
					{#each usertwynts.twynts as twynt}
						<Twynt {...twynt} {myId} twyntClick={handletwyntClick} />
					{/each}
				{/if}
			</div>
		</div>
	</div>
{:else}
	<p>Profile not found.</p>
{/if}

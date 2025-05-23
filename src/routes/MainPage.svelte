<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Reply, X } from 'lucide-svelte';
	import { cdnUrl, v } from './stores';
	import Skeleton from './Skeleton.svelte';
	import Twynt from './Twynt.svelte';
	import Navigation from './Navigation.svelte';
	import PostButton from './PostButton.svelte';
	import ProfileButton from './ProfileButton.svelte';
	import { toggleMode } from 'mode-watcher';
	import { onDestroy, onMount } from 'svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import { toast } from 'svelte-sonner';
	import { currentPage } from './stores';
	import Search from './Search.svelte';
	import Notifications from './Notifications.svelte';
	import ProfilePage from './ProfilePage.svelte';
	import { goto } from '$app/navigation';
	import TopTab from './TopTab.svelte';

	export let username: string;
	export let handle: string;
	// export let created_at: string;
	// export let iq: number;
	export let id: string;
	export let TwyntrOpened: string | null = null;
	export let profileOpened: string | null = null;

	let comment: string;
	let loadingFeed = true;

	let page: string = 'home';
	currentPage.subscribe((value) => {
		page = value;
	});
	interface FeedItem {
		id: string;
		content: string;
		userId: string;
		createdAt: number;
		views: number;
		reposted: boolean;
		likeCount: number;
		likedByFollowed: boolean;

		repostCount: number;
		commentCount: number;
		likedByUser: boolean;
		repostedByUser: boolean;
		handle: string;
		userCreatedAt: number;
		username: string;
		iq: number;
		bio: string;
		verified: boolean;
		has_image: boolean;

		parentId: string | null;
		parentContent: string | null;
		parentUserHandle: string | null;
		parentUserUsername: string | null;
		parentUserVerified: boolean | null;
		parentHasImage: boolean | null;
		parentUserBio: string | null;
		parentUserIq: number | null;
		parentUserId: string | null;
		parentCreatedAt: number | null;
		parentUserCreatedAt: number | null;
	}

	let feed: FeedItem[] = [];
	let comments: FeedItem[] = [];
	let selectedTwyntr: FeedItem | null = null;
	let referencedTwyntrs: FeedItem[] = [];
	let loadingComments = false;

	let currentTab = 'For you';
	const tabs = ['For you', 'Following', 'New'];

	let skeletonCount = 5;
	let loadingTab = false;
	function handleTabChange(tab: string) {
		currentTab = tab;
		loadingTab = true;
		feed = [];
		fetchFeed();

		if (currentTab === tabs[2]) {
			const eventSource = new EventSource('/api/sse');
			eventSource.onmessage = async (event) => {
				await renderTwyntrAtTop(JSON.parse(event.data));
			};
		}
	}

	let feedContainer: HTMLDivElement;

	let loadingBottomFeed = false;

	function handleScroll() {
		if (feedContainer) {
			const { scrollTop, scrollHeight, clientHeight } = feedContainer;

			if (scrollTop + clientHeight >= scrollHeight - 5 && !loadingBottomFeed) {
				loadingBottomFeed = true;

				fetchFeed(true);

				loadingBottomFeed = false;
			}
		}
	}

	if (TwyntrOpened !== null && TwyntrOpened !== '') {
		(async () => {
			selectedTwyntr = await getTwyntr(TwyntrOpened);

			comments = await getComments(TwyntrOpened);
		})();
	} else if (profileOpened !== null) {
		page = `profile${profileOpened}`;
	}

	async function getTwyntr(TwyntrOpened: string) {
		const response = await fetch('api/twynt?id=' + TwyntrOpened, { method: 'GET' });

		if (response.status !== 200) toast('Error loading Twyntr!');

		const res = await response.json();

		referencedTwyntrs = res.referencedTwyntrs || [];

		return res as FeedItem;
	}
	async function fetchFeed(append = false) {
		try {
			const excludePosts = feed.map((post: any) => post.id).join(',');
			console.log('Exclude Posts:', excludePosts);

			const response = await fetch(`api/feed?type=${currentTab}&excludePosts=${excludePosts}`, {
				method: 'GET'
			});

			if (response.status !== 200) {
				toast('Error generating feed! Please refresh the page.');
				return;
			}

			const res = await response.json();
			console.log('API Response:', res);

			if (!res.twynts || !Array.isArray(res.twynts)) {
				toast('Invalid feed response. Please refresh the page.');
				console.warn('twynts missing or invalid. Response:', res);
				return;
			}

			const newPosts = res.twynts.map((post: any) => ({ ...post }));

			if (append) {
				const uniqueNewPosts = newPosts.filter(
					(newPost: any) => !feed.some((existingPost: any) => existingPost.id === newPost.id)
				);

				feed = feed.concat(uniqueNewPosts);

				if (feed.length > 250) {
					feed = feed.slice(50);
				}
			} else {
				feed = newPosts;
			}
		} catch (error) {
			console.error('Error fetching feed:', error);
			toast('Error generating feed! Please refresh the page.');
		} finally {
			loadingFeed = false;
			loadingTab = false;
		}
	}

	function updateURL(newPath: string) {
		goto(newPath, { replaceState: true, noScroll: true });
	}

	async function handletwyntClick(id: string) {
		loadingComments = true;

		TwyntrOpened = id;
		referencedTwyntrs = [];
		selectedTwyntr =
			feed.find((Twyntr) => Twyntr.id === TwyntrOpened) || (await getTwyntr(TwyntrOpened));

		comments = await getComments(TwyntrOpened);
		loadingComments = false;
		if (!page.startsWith('profile')) updateURL(`/?id=${id}`);
	}

	async function getComments(id: string) {
		const response = await fetch('api/comments?id=' + id, {
			method: 'GET'
		});

		if (response.status !== 200) {
			toast(`Failed to load comments! Error: ${response.status} | ${response.statusText}`);
		}

		const res = await response.json();
		return res.map((post: any) => ({ ...post }));
	}

	async function postComment() {
		const response = await fetch('api/comment', {
			method: 'POST',
			body: JSON.stringify({ id: selectedTwyntr?.id, content: comment })
		});
		comment = '';

		if (response.status !== 201) {
			if (response.status == 429)
				return toast('Woah, slow down! You are being ratelimited. Please try again in a bit.');
			toast(
				`Something went wrong while commenting on this Twyntr. Error: ${response.status} | ${response.statusText}`
			);
		} else {
			toast('Your reply has been posted!');
			comments = [(await response.json()) as FeedItem, ...comments];
			if (selectedTwyntr) {
				selectedTwyntr.commentCount = Number(selectedTwyntr.commentCount) + 1;
			}
			selectedTwyntr = selectedTwyntr;
		}
	}

	onMount(async () => {
		fetchFeed();

		if (feedContainer) {
			feedContainer.addEventListener('scroll', handleScroll);
		}
	});

	onDestroy(() => {
		if (feedContainer) {
			feedContainer.removeEventListener('scroll', handleScroll);
		}
	});

	async function renderTwyntrAtTop(TwyntrId: string) {
		const Twyntr = await getTwyntr(TwyntrId);
		feed = [Twyntr].concat(feed);
	}
	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		const text = event.clipboardData?.getData('text/plain') || '';
		document.execCommand('insertText', false, text);
	}
</script>

<div class="flex w-full justify-center">
	<div class="w-full max-w-[1400px]">
		<div
			class="flex h-dvh w-full flex-col-reverse justify-end gap-4 overflow-hidden pb-20 md:flex-row md:pb-0"
		>
			<div class="fixed inset-x-0 bottom-0 z-50 flex flex-col md:static md:flex-row">
				<div
					class="md:max-w-1/3 flex w-full min-w-full flex-row items-start gap-2 px-2 py-2 md:w-auto md:flex-col md:pt-0"
				>
					<button class="mt-5 hidden md:block" on:click={toggleMode}>
						<img class="mb-5 size-20 cursor-pointer" src="logo.svg" alt="Logo" />
					</button>
					<Navigation {handle} {id} />
					<div class="hidden md:flex md:w-full">
						<PostButton userId={id} />
						<ProfileButton src={cdnUrl(id, 'medium')} name={username} handle="@{handle}" />
					</div>
				</div>
				<Separator class="h-[1px] w-full md:h-full md:w-[1px]" />
			</div>

			<div class="flex h-full w-full flex-col items-center gap-1 md:flex-row md:items-start">
				<div
					class="flex h-full w-full max-w-[600px] flex-col overflow-hidden md:px-1 {TwyntrOpened &&
					selectedTwyntr
						? 'hidden md:flex'
						: ''}"
				>
					{#if page === 'search'}
						<Search userId={id} {handletwyntClick} />
					{:else if page === 'notifications'}
						<Notifications {handletwyntClick} />
					{:else if page.startsWith('profile')}
						{#key page}
							<ProfilePage
								myId={id}
								profileHandle={page.replace('profile', '')}
								{handletwyntClick}
							/>
						{/key}
					{:else if page === 'home'}
						<div class="min-w-1/3 mt-5 flex h-full flex-col md:px-1">
							<TopTab {tabs} {currentTab} onTabChange={handleTabChange} />
							<Separator class="mt-4" />

							<!-- Feed -->
							<div
								class="flex h-full w-full flex-col gap-2 overflow-y-auto px-1 py-2"
								bind:this={feedContainer}
							>
								{#if loadingTab}
									{#each Array(skeletonCount) as _}
										<Skeleton />
									{/each}
								{:else if loadingFeed}
									<LoadingSpinner />
								{:else}
									{#each feed as lynt}
										<Twynt {...lynt} myId={id} twyntClick={handletwyntClick} />
									{/each}
								{/if}
								{#if loadingBottomFeed}
									<LoadingSpinner />
								{/if}
							</div>
						</div>
					{/if}
				</div>
				{#if TwyntrOpened && selectedTwyntr}
					<div class="mb-2 h-full w-full max-w-[530px] pb-10">
						<button
							class="flex w-full justify-end p-2 md:justify-start"
							on:click={() => {
								TwyntrOpened = null;
								selectedTwyntr = null;
							}}><X /></button
						>
						<div
							class="md:min-w-1/2 mx-auto flex h-full max-w-[600px] flex-col gap-2 overflow-y-auto overflow-x-hidden px-1 md:mx-0"
							id="Twyntr-container"
						>
							<!-- Referenced Twyntrs -->
							<div class="w-full">
								{#each referencedTwyntrs as Twyntr (Twyntr.id)}
									<Twynt {...Twyntr} myId={id} twyntClick={handletwyntClick} connect={true} />
								{/each}
							</div>

							<!-- Selected Twyntr -->
							<div class="w-full" id="selected-Twyntr">
								<Twynt
									{...selectedTwyntr}
									myId={id}
									truncateContent={false}
									twyntClick={handletwyntClick}
								/>
							</div>

							<div class="flex w-full items-center gap-2 rounded-xl bg-border p-3">
								<Reply size={32} />

								<div
									contenteditable="true"
									role="textbox"
									spellcheck="true"
									tabindex="0"
									bind:textContent={comment}
									class="overflow-wrap-anywhere w-full text-lg outline-none"
									placeholder="Reply..."
									on:paste={handlePaste}
								/>

								<Button on:click={postComment}>Post</Button>
							</div>
							<Separator />
							{#if loadingComments}
								<LoadingSpinner occupy_screen={false} />
							{:else if comments.length === 0}
								<Label class="flex justify-center text-lg">This Twyntr has no comments.</Label>
							{:else}
								{#each comments as Twyntr}
									<Twynt {...Twyntr} myId={id} twyntClick={handletwyntClick} />
								{/each}
							{/if}
							<div class="flex h-full w-full flex-col gap-2 overflow-y-auto"></div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

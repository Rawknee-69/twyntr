<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, CalendarDays, Heart, MessageSquare, UserPlus } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import * as HoverCard from '@/components/ui/hover-card/index.js';
	import Avatar from './Avatar.svelte';
	import { Button } from '@/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { cdnUrl, unreadMessages } from './stores';

	interface Notification {
		sourceUserBio: string;
		id: string;
		type: 'like' | 'comment' | 'follow';
		sourceUserId: string;
		sourceUser: string;
		sourceUserHandle: string;
		sourceUserIq: number;
		sourceUserVerified: boolean;
		sourceUserCreatedAt: string;
		twyntContent?: string;
		twyntId?: string;
		read: boolean;
		createdAt: string;
	}

	let notifications: Notification[] = [];
	$: reactiveNotifications = notifications;

	export let handletwyntClick = (id: string) => {};

	onMount(async () => {
		const response = await fetch('/api/notifications');
		if (response.ok) {
			notifications = await response.json();
		} else {
			console.error('Failed to fetch notifications');
		}

		const response2 = await fetch('/api/notifications/unread');
		if (response2.ok) {
			$unreadMessages = (await response2.json()).count;
		} else {
			console.error('Failed to fetch unread messages');
		}
	});

	function formatTimeAgo(dateString: string) {
		const date = new Date(dateString);
		const now = new Date();
		const secondsPast = (now.getTime() - date.getTime()) / 1000;

		if (secondsPast < 60) {
			return `${Math.floor(secondsPast)}s ago`;
		}
		if (secondsPast < 3600) {
			return `${Math.floor(secondsPast / 60)}m ago`;
		}
		if (secondsPast <= 86400) {
			return `${Math.floor(secondsPast / 3600)}h ago`;
		}
		if (secondsPast > 86400) {
			const day = date.getDate();
			const month = date.toLocaleString('default', { month: 'short' });
			const year = date.getFullYear();
			return `${day} ${month} ${year}`;
		}
	}

	function getNotificationIcon(type: 'like' | 'comment' | 'follow') {
		switch (type) {
			case 'like':
				return Heart;
			case 'comment':
				return MessageSquare;
			case 'follow':
				return UserPlus;
			default:
				return Bell;
		}
	}

	function getNotificationMessage(notification: Notification): string {
		switch (notification.type) {
			case 'like':
				return 'liked your twynt';
			case 'comment':
				return 'commented on your twynt';
			case 'follow':
				return 'started following you';
			default:
				return 'interacted with your twynt';
		}
	}
	function formatDate(_date: string) {
		let date = new Date(_date);

		const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
		return date.toLocaleDateString(undefined, options);
	}

	async function markRead() {
		const response = await fetch('api/notifications', { method: 'PATCH' });

		if (response.status !== 200) {
			toast(
				`Something went wrong while marking all notifications as read. Error: ${response.status} | ${response.statusText}`
			);
			return;
		}

		reactiveNotifications = reactiveNotifications.map((notif) => ({ ...notif, read: true }));
		$unreadMessages = 0;
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="mb-6 inline-flex w-full justify-between">
		<h1 class="text-3xl font-bold">Notifications</h1>
		<Button class="ml-4" on:click={markRead}>Mark All as Read</Button>
	</div>

	<Card.Root class="mx-auto w-full bg-border">
		<Card.Header>
			<Card.Title>Recent Activity</Card.Title>
			<Card.Description>Your latest 50 notifications</Card.Description>
		</Card.Header>
		<Card.Content>
			<ScrollArea class="h-[70vh] w-full rounded-md">
				<div class="pr-4">
					<!-- Add right padding for scrollbar -->
					{#if notifications.length === 0}
						<p class="py-4 text-center text-muted-foreground">No notifications yet.</p>
					{:else}
						<ul class="flex w-full flex-col items-center gap-4">
							{#each reactiveNotifications as notification (notification.id)}
								<li class="w-full">
									<button
										on:click={() => {
											if (notification.twyntId) {
												handletwyntClick(notification.twyntId);
											}
										}}
										class="flex w-full items-start space-x-4 rounded-lg bg-twynt-foreground p-4 text-left transition-colors"
									>
										<div class="flex-shrink-0">
											<svelte:component
												this={getNotificationIcon(notification.type)}
												class="h-6 w-6 text-primary"
											/>
										</div>
										<div class="flex-grow">
											<p class="text-sm font-medium">
												<HoverCard.Root>
													<HoverCard.Trigger
														href="/@{notification.sourceUserHandle}"
														rel="noreferrer noopener"
														class="max-w-[50%] truncate rounded-sm font-bold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-black"
													>
														@{notification.sourceUser}
													</HoverCard.Trigger>
													<HoverCard.Content class="w-80">
														<div class="flex justify-between space-x-4">
															<Avatar
																size={10}
																src={cdnUrl(notification.sourceUserId, 'small')}
																alt="Profile picture."
															/>

															<div class="space-y-1">
																<h4 class="text-sm font-semibold">{notification.sourceUser}</h4>
																<h4 class="text-sm font-semibold">
																	@{notification.sourceUserHandle}
																</h4>
																<p class="text-sm">{notification.sourceUserBio}</p>
																<div class="flex items-center pt-2">
																	<CalendarDays class="mr-2 h-4 w-4 opacity-70" />
																	<span class="text-xs text-muted-foreground">
																		Joined {formatDate(notification.sourceUserCreatedAt)}
																	</span>
																</div>
															</div>
														</div>
													</HoverCard.Content>
												</HoverCard.Root>

												{getNotificationMessage(notification)}
											</p>
											{#if notification.twyntContent}
												<p class="mt-1 text-sm text-muted-foreground">
													"{notification.twyntContent}"
												</p>
											{/if}
											<p class="mt-1 text-xs text-muted-foreground">
												{formatTimeAgo(notification.createdAt)}
											</p>
										</div>
										{#if !notification.read}
											<div class="flex-shrink-0">
												<div class="h-2 w-2 rounded-full bg-primary"></div>
											</div>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</ScrollArea>
		</Card.Content>
	</Card.Root>
</div>

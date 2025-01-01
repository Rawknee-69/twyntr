<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';
	import { onMount } from 'svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import Auth from './Auth.svelte';
	import AccountCreator from './AccountCreator.svelte';
	import { page } from '$app/state';
	import MainPage from './MainPage.svelte';
	import Cookies from 'js-cookie';

	interface UserData {
		username: string;
		handle: string;
		created_at: string;
		iq: number;
		id: string;
	}

	let authenticated: boolean = false;
	let loading: boolean = true;
	let noAccount: boolean = false;
	let userData: UserData = {
		username: '',
		handle: '',
		created_at: '',
		iq: 90,
		id: ''
	};

	function isValidUserData(data: any): data is UserData {
		return (
			typeof data === 'object' &&
			typeof data.username === 'string' &&
			typeof data.handle === 'string' &&
			typeof data.created_at === 'string' &&
			typeof data.iq === 'number' &&
			typeof data.id === 'string'
		);
	}

	async function checkAuthAndProfileStatus() {
		if (Cookies.get('temp-discord-token')) {
			authenticated = true;
		}

		const cachedData = localStorage.getItem('user-data');
		if (cachedData) {
			try {
				const parsedData = JSON.parse(cachedData);
				if (isValidUserData(parsedData)) {
					userData = parsedData;
					loading = false;
					noAccount = false;
					authenticated = true;
				}
			} catch (error) {
				console.error('Failed to load user data from cache', error);
				localStorage.removeItem('user-data');
			}
		}

		try {
			const loginResponse = await fetch('api/me', {
				method: 'GET',
				credentials: 'include'
			});

			if (loginResponse.status === 200) {
				const res = await loginResponse.json();
				userData = {
					username: res.username,
					handle: res.handle,
					created_at: res.created_at,
					iq: res.iq,
					id: res.id
				};

				localStorage.setItem('user-data', JSON.stringify(userData));
				noAccount = false;
			} else {
				noAccount = true;
			}
		} catch (error) {
			console.error('Error checking user status:', error);
			noAccount = true;
		}

		loading = false;
	}

	onMount(() => {
		checkAuthAndProfileStatus();
	});

	$: TwyntrOpened = page.url.searchParams.get('id');
</script>

<ModeWatcher defaultMode={'light'} />
<Toaster />

{#if loading}
	<LoadingSpinner />
{:else if !authenticated}
	<Auth />
{:else if noAccount}
	<AccountCreator />
{:else}
	<MainPage {...userData} {TwyntrOpened} />
{/if}

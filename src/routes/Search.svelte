<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import Twynt from './Twynt.svelte';
	import { onMount } from 'svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import { toast } from 'svelte-sonner';

	let searchQuery = '';
	let searchResults: any[] = [];
	let isLoading = false;
	let hasSearched = false;

	export let handletwyntClick;
	export let userId;

	async function performSearch() {
		if (!searchQuery.trim()) return;
		isLoading = true;
		hasSearched = true;
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
				method: 'GET'
			});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			searchResults = await response.json();
		} catch (error) {
			console.error('Search error:', error);
			toast('Failed to perform search. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			performSearch();
		}
	}

	function handleInput() {
		hasSearched = false;
		searchResults = [];
	}
</script>

<div class="mx-auto mt-5 flex h-full w-full flex-col items-center">
	<h1 class="mb-4 text-2xl font-bold">Search twynts</h1>
	<div class="mb-4 flex w-full p-1">
		<Input
			type="text"
			placeholder="Search for twynts..."
			bind:value={searchQuery}
			on:keypress={handleKeyPress}
			on:input={handleInput}
			class="mr-2 flex-grow"
		/>
		<Button on:click={performSearch}>Search</Button>
	</div>
	<div class="w-full flex-grow overflow-hidden">
		<div class="h-full overflow-y-auto overflow-x-hidden">
			{#if isLoading}
				<LoadingSpinner />
			{:else if hasSearched}
				{#if searchResults.length > 0}
					<div class="flex flex-col gap-4 px-1">
						{#each searchResults as twynt}
							<Twynt {...twynt} myId={userId} on:twyntClick={handletwyntClick} />
						{/each}
					</div>
				{:else}
					<p>No results found for "{searchQuery}"</p>
				{/if}
			{/if}
		</div>
	</div>
</div>

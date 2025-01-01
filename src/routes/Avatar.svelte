<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let size: number = 12;
	export let src: string = 'https://github.com/face-hh.png';
	export let alt: string = 'Avatar';
	export let border: boolean = false;
	export let editable: boolean = false;

	const dispatch = createEventDispatcher<{
		change: { file: File };
	}>();

	function handleClick() {
		if (editable) {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*';
			input.onchange = (e: Event) => {
				const target = e.target as HTMLInputElement;
				const file = target.files?.[0];
				if (file) {
					dispatch('change', { file });

					const reader = new FileReader();
					reader.onload = (e: ProgressEvent<FileReader>) => {
						const result = e.target?.result;
						if (typeof result === 'string') {
							src = result;
						}
					};
					reader.readAsDataURL(file);
				}
			};
			input.click();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			handleClick();
		}
	}

	function handleImageError(e: Event) {
		const img = e.target as HTMLImageElement;
		img.src = '/default.png';
	}
</script>

{#if editable}
	<button
		type="button"
		on:click={handleClick}
		on:keydown={handleKeyDown}
		class="m-0 border-none bg-transparent p-0"
		aria-label="Change avatar image"
	>
		<img
			{src}
			{alt}
			class="h-{size} w-{size} rounded-full {border
				? 'border-2 border-solid border-primary'
				: ''} cursor-pointer text-center"
			on:error|once={handleImageError}
		/>
	</button>
{:else}
	<img
		{src}
		{alt}
		class="h-{size} w-{size} rounded-full {border
			? 'border-2 border-solid border-primary'
			: ''} text-center"
		on:error|once={handleImageError}
	/>
{/if}

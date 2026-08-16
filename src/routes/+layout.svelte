<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { loadUserSettings, userSettings } from '$lib/stores/userSettings.svelte';

	let { children } = $props();

	onMount(loadUserSettings);

	// Mirrors the loaded preference onto <html> — app.css's
	// [data-text-size='large'|'xl'] overrides key off this attribute, so
	// every .t-* class on every screen scales together with no per-component
	// changes. "normal" needs no attribute at all (matches the unscaled base).
	$effect(() => {
		if (userSettings.textSize === 'normal') {
			delete document.documentElement.dataset.textSize;
		} else {
			document.documentElement.dataset.textSize = userSettings.textSize;
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

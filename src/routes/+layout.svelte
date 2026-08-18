<script lang="ts">
	import { onMount } from 'svelte';
	import { registerSW } from 'virtual:pwa-register';
	import '../app.css';
	import { loadUserSettings, userSettings } from '$lib/stores/userSettings.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import AppBar from '$lib/components/AppBar.svelte';

	let { children } = $props();

	onMount(loadUserSettings);

	// Registers sw.ts at root scope ('/') so it can control both the
	// marketing page and the app routes. vite-plugin-pwa's registerType:
	// 'autoUpdate' (vite.config.ts) handles the update-check loop from here.
	onMount(() => registerSW({ immediate: true }));

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

	const TOP_LEVEL_ROUTES = new Set(['/today', '/medicines', '/settings']);

	let showBottomNav = $derived(TOP_LEVEL_ROUTES.has(page.route.id ?? ''));

	// Every sub-page gets a fixed backTo — not history.back() — so a deep
	// link or a post-save redirect always has somewhere sensible to go. The
	// wizard steps carry the current query string back (id, and whatever
	// dose/frequency params the earlier steps forwarded) — each earlier step's
	// loader only reads what it needs and ignores the rest, so passing the
	// full search string back is always safe. That concatenation loses the
	// `resolve()` return type's branding, hence the cast: every piece of the
	// string still comes from `resolve()` or `page.url.search`, never
	// free-typed, so it's a safe assertion rather than an unchecked one.
	let backTo = $derived.by((): ResolvedPathname | null => {
		const id = page.params.id;
		switch (page.route.id) {
			case '/medicines/[id]':
				return resolve('/medicines');
			case '/medicines/[id]/edit':
			case '/medicines/[id]/refill':
				return id ? resolve('/medicines/[id]', { id }) : resolve('/medicines');
			case '/medicines/add':
				return resolve('/medicines');
			case '/medicines/add/manual':
			case '/medicines/add/confirm':
				return resolve('/medicines/add');
			case '/medicines/add/pill-photo':
				return `${resolve('/medicines/add/confirm')}${page.url.search}` as ResolvedPathname;
			case '/medicines/add/schedule':
				return `${resolve('/medicines/add/pill-photo')}${page.url.search}` as ResolvedPathname;
			case '/medicines/add/supply':
				return `${resolve('/medicines/add/schedule')}${page.url.search}` as ResolvedPathname;
			default:
				return null;
		}
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/icons/icon-192.png" />
</svelte:head>

{#if backTo}
	<AppBar {backTo} />
{/if}

{@render children()}

{#if showBottomNav}
	<div class="nav-spacer"></div>
	<BottomNav />
{/if}

<style>
	.nav-spacer {
		height: calc(var(--tap-primary) + var(--sp-4) + env(safe-area-inset-bottom, 0px));
	}
</style>

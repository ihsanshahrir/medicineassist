<!--
  Persistent bottom tab bar for the three top-level screens. Mirrors
  design/preview/components-navigation.html — see DESIGN.md for the "never
  icon-alone" rule this also follows (every tab pairs the glyph with a
  visible label).
-->
<script lang="ts">
	import Pictogram from './Pictogram.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const tabs = [
		{ href: resolve('/today'), label: 'Today', icon: 'nav-today' },
		{ href: resolve('/medicines'), label: 'Medicines', icon: 'nav-medicines' },
		{ href: resolve('/settings'), label: 'Settings', icon: 'nav-settings' }
	];
</script>

<nav class="bottom-nav" aria-label="Main">
	{#each tabs as tab (tab.href)}
		<a href={tab.href} aria-current={page.url.pathname === tab.href ? 'page' : undefined}>
			<Pictogram id={tab.icon} size={24} />
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>

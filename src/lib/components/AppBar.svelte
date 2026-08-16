<!--
  Sticky back bar for every sub-page (detail, edit, refill, wizard steps).
  `backTo` is a fixed href rather than history.back() so a deep link or a
  post-redirect landing (e.g. after saving) still has somewhere to go —
  mirrors design/preview/components-navigation.html.
-->
<script lang="ts">
	import Pictogram from './Pictogram.svelte';
	import type { ResolvedPathname } from '$app/types';

	interface Props {
		backTo: ResolvedPathname;
		title?: string;
	}
	let { backTo, title }: Props = $props();
</script>

<div class="app-bar">
	<a class="back-link" href={backTo}>
		<Pictogram id="nav-back" size={20} />
		Back
	</a>
	{#if title}<span class="title">{title}</span>{/if}
</div>

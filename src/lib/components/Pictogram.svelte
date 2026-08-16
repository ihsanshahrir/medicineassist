<!--
  Thin wrapper around the shared sprite (static/pictograms.svg, copied at build
  time from design/pictograms.svg — never edit the sprite here, edit the
  source and let vite-plugin-static-copy re-sync it).

  Per DESIGN.md: a pictogram is never load-bearing alone. `label` sets an
  accessible name for screen readers, but every real usage in the app must
  also show the text label visibly next to the icon — this component doesn't
  enforce that (it can't), the surrounding markup must.
-->
<script lang="ts">
	interface Props {
		/** Symbol id from the sprite, e.g. "pic-with-food" or "glyph-tablet". */
		id: string;
		/** Accessible name. Omit only when a visible label already sits right next to this icon. */
		label?: string;
		size?: number;
		class?: string;
	}

	let { id, label, size = 24, class: className = '' }: Props = $props();
</script>

<svg
	class={className}
	style:width="{size}px"
	style:height="{size}px"
	aria-hidden={label ? undefined : 'true'}
	role={label ? 'img' : undefined}
>
	{#if label}<title>{label}</title>{/if}
	<use href="/pictograms.svg#{id}" />
</svg>

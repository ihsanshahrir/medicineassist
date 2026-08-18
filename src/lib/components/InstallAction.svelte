<!--
  The one install button. Landing hero, in-app banner and Settings all render
  this, so the "one tap where the platform allows it, instructions where it
  doesn't" branch exists exactly once.

  Specimen: design/preview/components-install.html.

  Renders nothing when the app is already installed, when detection hasn't run
  yet (avoids an SSR/hydration mismatch), or on a platform that genuinely
  cannot install.
-->
<script lang="ts">
	import InstallSheet from './InstallSheet.svelte';
	import { canOfferInstall, install, requestInstall } from '$lib/stores/installPrompt.svelte';

	interface Props {
		/** Button utility classes. Never pair .btn with .btn-text — DESIGN.md rule 9. */
		class?: string;
		label?: string;
		/** Fired once the OS dialog is accepted — the banner uses it to self-hide. */
		onInstalled?: () => void;
	}

	let {
		class: className = 'btn btn-primary',
		label = 'Add to Home Screen',
		onInstalled
	}: Props = $props();

	let sheetOpen = $state(false);
	let busy = $state(false);

	type SheetPlatform = 'ios-safari' | 'ios-browser' | 'manual-menu';

	let sheetPlatform: SheetPlatform = $derived.by(() => {
		const state = install.state;
		return state === 'ios-safari' || state === 'ios-browser' ? state : 'manual-menu';
	});

	async function handleClick() {
		// requestInstall() must reach evt.prompt() synchronously within this
		// gesture — no await before the call, or Chromium rejects it.
		const outcome = await requestInstall();
		if (outcome === 'needs-instructions') {
			sheetOpen = true;
			return;
		}
		if (outcome === 'accepted') {
			busy = true;
			onInstalled?.();
		}
	}
</script>

{#if canOfferInstall()}
	<button class={className} type="button" onclick={handleClick} disabled={busy}>
		{label}
	</button>

	{#if sheetOpen}
		<InstallSheet open={sheetOpen} platform={sheetPlatform} onClose={() => (sheetOpen = false)} />
	{/if}
{/if}

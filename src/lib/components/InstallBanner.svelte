<!--
  The in-app install nudge (docs/PRD.md line 106). Rendered once from
  +layout.svelte on the three top-level screens rather than per-page.

  Specimen: design/preview/components-install.html; shape matches the existing
  .push-banner on the Today screen — <b> headline, <span> explanation, a
  .btn-secondary action — so the two banners read as one pattern.

  Dismissal escalates 7d -> 30d -> permanent (installPrompt.svelte.ts). That's
  safe because Settings keeps a permanent install button.
-->
<script lang="ts">
	import InstallAction from './InstallAction.svelte';
	import {
		canOfferInstall,
		install,
		suppressInstallBanner
	} from '$lib/stores/installPrompt.svelte';
</script>

{#if canOfferInstall() && !install.bannerSuppressed}
	<div class="install-banner">
		<div class="copy">
			<b>Add MedsAssist to your Home Screen</b>
			<span
				>Reminders only arrive reliably from the Home Screen icon — on iPhone it's required.</span
			>
		</div>
		<InstallAction class="btn btn-secondary install-btn" label="Add" />
		<button
			class="dismiss"
			type="button"
			aria-label="Not now — hide this reminder"
			onclick={suppressInstallBanner}
		>
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
				<path
					d="M6 6l12 12M18 6L6 18"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>
{/if}

<style>
	.install-banner {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		background: var(--surface);
		box-shadow: var(--shadow-1);
		border-radius: var(--r-card);
		padding: var(--sp-4);
		margin: 0 auto var(--sp-4);
		max-width: 460px;
		/* Keeps the card off the screen edges at 375px, where max-width alone
		   would let it run full-bleed. */
		width: calc(100% - 2 * var(--sp-4));
	}
	.copy {
		flex: 1 1 auto;
	}
	.copy b {
		display: block;
		font-size: var(--t-body-size);
		line-height: var(--t-body-line);
	}
	.copy span {
		display: block;
		font-size: var(--t-caption-size);
		color: var(--ink-2);
		margin-top: 2px;
	}
	.install-banner :global(.install-btn) {
		flex: 0 0 auto;
		width: auto;
		min-height: var(--tap-min);
		padding: 0 var(--sp-4);
	}
	.dismiss {
		flex: 0 0 auto;
		width: var(--tap-min);
		height: var(--tap-min);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		border-radius: var(--r-chip);
		color: var(--ink-2);
		cursor: pointer;
	}
</style>

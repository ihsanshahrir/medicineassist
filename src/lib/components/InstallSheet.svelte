<!--
  Install instructions for platforms with no programmatic install API — iOS
  Safari above all, where Web Push only works from an installed icon.

  Specimen: design/preview/components-install.html. The sheet chrome uses
  --r-sheet (28px), the one radius token in foundations-spacing-radius.html
  that had no consumer before this.

  Native <dialog> + showModal(), not a hand-rolled overlay: it brings the focus
  trap, Escape handling and aria-modal semantics with it, and renders in the
  top layer so it can't lose a z-index fight with BottomNav (z-index: 10).

  Steps name the iOS controls in words because pictograms.svg has no share or
  add-to-home glyph yet, and DESIGN.md rule 8 says flag a missing mark rather
  than draw one ad hoc.
-->
<script lang="ts">
	interface Props {
		open: boolean;
		platform: 'ios-safari' | 'ios-browser' | 'manual-menu';
		/** Fired for the Close button, Escape and backdrop click alike. */
		onClose: () => void;
	}

	let { open, platform, onClose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	// Escape fires 'close' without ever running a button handler, so routing
	// every exit through onclose is what keeps the three ways out consistent.
	function handleClose() {
		if (open) onClose();
	}

	// <dialog> has no native backdrop-click. The inner wrapper is what makes
	// this target check correct — clicks on the content bubble from a child.
	function handleDialogClick(event: MouseEvent) {
		if (event.target === dialogEl) onClose();
	}
</script>

<dialog
	bind:this={dialogEl}
	tabindex="-1"
	aria-labelledby="install-sheet-title"
	aria-describedby="install-sheet-steps"
	onclose={handleClose}
	onclick={handleDialogClick}
>
	<div class="sheet-body">
		<h2 class="t-h2" id="install-sheet-title">Add MedsAssist to your Home Screen</h2>

		<ol class="t-body" id="install-sheet-steps">
			{#if platform === 'ios-safari'}
				<li>
					Tap <b>Share</b> — the square with an arrow pointing up, at the bottom of the screen.
				</li>
				<li>Scroll down and tap <b>Add to Home Screen</b>.</li>
				<li>Tap <b>Add</b> in the top corner.</li>
			{:else if platform === 'ios-browser'}
				<li>Tap the <b>menu</b> button in your browser's toolbar.</li>
				<li>Tap <b>Add to Home Screen</b>.</li>
				<li>
					If you don't see it, open <b>medsassist</b> in <b>Safari</b> instead — reminders are most reliable
					that way.
				</li>
			{:else}
				<li>Open your browser's <b>menu</b> — usually three dots or three lines.</li>
				<li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
				<li>Confirm to finish.</li>
			{/if}
		</ol>

		<p class="t-caption why">
			Reminders only arrive reliably from the Home Screen icon — on iPhone it's required.
		</p>

		<button class="btn btn-secondary close-btn" type="button" onclick={onClose}>Close</button>
	</div>
</dialog>

<style>
	dialog {
		border: none;
		padding: 0;
		background: transparent;
		max-width: 100%;
		width: 100%;
		max-height: 100%;
		margin: auto auto 0;
	}
	dialog::backdrop {
		background: rgba(20, 32, 28, 0.5);
	}
	.sheet-body {
		background: var(--surface);
		border-radius: var(--r-sheet) var(--r-sheet) 0 0;
		box-shadow: var(--shadow-3);
		padding: var(--sp-6);
		padding-bottom: calc(var(--sp-6) + env(safe-area-inset-bottom, 0px));
		max-width: 460px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		color: var(--ink);
	}
	ol {
		margin: 0;
		padding-left: var(--sp-6);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.why {
		margin: 0;
		color: var(--ink-2);
	}
	/* A visible way out is mandatory — Escape can't be the only exit for an
	   audience that skews older (DESIGN.md rule 10 applied to a modal). */
	.close-btn {
		width: 100%;
		min-height: var(--tap-primary);
	}
	/* The page behind a top-layer dialog still scrolls on some browsers. */
	:global(html:has(dialog[open])) {
		overflow: hidden;
	}
</style>

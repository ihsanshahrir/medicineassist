<!--
  Compact timeline row — mirrors design/preview/components-medicine-row.html.
  State is always carried by icon + label + color together (never color
  alone, per DESIGN.md rule) — "missed" uses the same neutral tokens as
  "upcoming", deliberately, never a red/alarm treatment. "overdue" is the one
  step up from neutral, and uses the existing amber --warn-* tokens (the same
  ones the supply banner uses) rather than anything alarming.

  Keyed on DoseDisplayState, not the raw dose_log status: a 'pending' row reads
  as Upcoming before its time and Overdue after it, and only the derived state
  knows which (see $lib/shared/doseState).
-->
<script lang="ts">
	import type { DoseDisplayState } from '$lib/shared/doseState';

	interface Props {
		state: DoseDisplayState;
		title: string; // e.g. "6:00 AM · Vitamin D"
		subtitle: string; // e.g. "Taken at 6:04 AM" / "2 tablets" / "Not marked"
		busy?: boolean;
		// Passing a handler is what makes the row actionable. Late logging is a
		// real adherence behaviour — people take the pill and mark it afterwards —
		// so an overdue or missed dose must stay loggable from the timeline.
		onTake?: () => void;
		onSkip?: () => void;
		onUndo?: () => void;
	}

	let { state, title, subtitle, busy = false, onTake, onSkip, onUndo }: Props = $props();

	const badge: Record<DoseDisplayState, { glyph: string; tag: string; cls: string }> = {
		taken: { glyph: '✓', tag: 'Done', cls: 'done' },
		upcoming: { glyph: '○', tag: 'Upcoming', cls: 'upcoming' },
		due: { glyph: '●', tag: 'Now', cls: 'now' },
		overdue: { glyph: '!', tag: 'Overdue', cls: 'warn' },
		snoozed: { glyph: '⏱', tag: 'Snoozed', cls: 'upcoming' },
		skipped: { glyph: '⊘', tag: 'Skipped', cls: 'upcoming' },
		missed: { glyph: '–', tag: 'Missed', cls: 'missed' }
	};

	let b = $derived(badge[state]);
	let hasActions = $derived(Boolean(onTake || onSkip || onUndo));
</script>

<div class="row" class:highlight={state === 'due' || state === 'overdue'}>
	<div class="row-main">
		<div class="icon-badge {b.cls}">{b.glyph}</div>
		<div class="info">
			<b>{title}</b>
			<span>{subtitle}</span>
		</div>
		<div class="tag {b.cls}">{b.tag}</div>
	</div>
	{#if hasActions}
		<div class="row-actions">
			{#if onTake}
				<button class="row-btn primary" disabled={busy} onclick={onTake}>Taken</button>
			{/if}
			{#if onSkip}
				<button class="row-btn" disabled={busy} onclick={onSkip}>Skip</button>
			{/if}
			{#if onUndo}
				<button class="row-btn" disabled={busy} onclick={onUndo}>Undo</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.row {
		padding: var(--sp-3) var(--sp-4);
		background: var(--surface);
		border-radius: var(--r-inner);
		box-shadow: var(--shadow-1);
		margin-bottom: var(--sp-2);
	}
	.row.highlight {
		background: var(--state-now-bg);
	}
	.row-main {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.icon-badge {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--t-caption-size);
		font-weight: 700;
		flex: 0 0 auto;
	}
	.icon-badge.done {
		background: var(--state-done-bg);
		color: var(--state-done);
	}
	.icon-badge.upcoming {
		background: var(--surface-sunk);
		color: var(--ink-3);
	}
	.icon-badge.missed {
		background: var(--state-missed-bg);
		color: var(--state-missed-text);
	}
	.icon-badge.warn {
		background: var(--warn-bg);
		color: var(--warn-text);
	}
	.icon-badge.now {
		background: var(--state-now-bg);
		color: var(--sage-700);
	}
	.info {
		flex: 1;
		min-width: 0;
	}
	.info b {
		font-size: var(--t-body-size);
		line-height: var(--t-body-line);
		display: block;
	}
	.info span {
		font-size: var(--t-caption-size);
		color: var(--ink-2);
	}
	.tag {
		font-size: var(--t-caption-size);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: var(--sp-1) var(--sp-3);
		border-radius: 999px;
		white-space: nowrap;
	}
	.tag.done {
		background: var(--state-done-bg);
		color: var(--state-done);
	}
	.tag.upcoming {
		background: var(--surface-sunk);
		color: var(--ink-2);
	}
	.tag.missed {
		background: var(--state-missed-bg);
		color: var(--state-missed-text);
	}
	.tag.warn {
		background: var(--warn-bg);
		color: var(--warn-text);
	}
	.tag.now {
		background: var(--sage-700);
		color: #fff;
	}
	.row-actions {
		display: flex;
		gap: var(--sp-2);
		margin-top: var(--sp-2);
		padding-left: calc(34px + var(--sp-3));
	}
	.row-btn {
		min-height: var(--tap-min);
		padding: 0 var(--sp-4);
		border-radius: var(--r-inner);
		border: 1px solid var(--line-strong);
		background: var(--surface);
		color: var(--ink);
		font: 600 var(--t-caption-size) var(--font-sans);
		cursor: pointer;
	}
	.row-btn.primary {
		background: var(--sage-700);
		border-color: var(--sage-700);
		color: #fff;
	}
	.row-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>

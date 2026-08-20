<!--
  The Now card — single or grouped medicines due in the current window.
  Mirrors design/preview/components-dose-card.html and screens-today.html
  exactly (same layout shape, same tokens); this is the Svelte version of
  those static specimens, not a redesign.

  Grouping + per-medicine partial completion, and the neutral (never red)
  language for the secondary actions, are both PRD requirements — see
  DESIGN.md rules 2 and the "Taken all" grouping note in docs/PRD.md §F3.

  Two variants:
   - 'active'  — the dose group that is due or overdue right now, fully actionable.
   - 'next-up' — a read-only preview of the next group when nothing is due yet,
                 so the card never disappears between dose windows.

  Once every medicine in the group is resolved the card stays mounted and swaps
  its actions for a confirmation + Undo (PRD §F3 A's "10-second Undo"); the page
  unmounts it when the grace window lapses.
-->
<script lang="ts">
	import Pictogram from './Pictogram.svelte';
	import { DOSE_UNIT_GLYPH, TIME_ANCHOR_PIC } from '$lib/shared/instructionTags';
	import type { DoseUnit } from '$lib/shared/types';
	import type { DoseDisplayState } from '$lib/shared/doseState';

	interface DoseCardMedicine {
		doseLogId: string;
		medicineId: string;
		name: string;
		strength: string | null;
		accentIndex: number;
		doseAmount: number;
		doseUnit: DoseUnit;
		state: DoseDisplayState;
	}

	interface Props {
		timeLabel: string; // e.g. "8:00 AM"
		anchorLabel: 'morning' | 'afternoon' | 'evening' | 'night';
		anchorText: string; // e.g. "Morning"
		medicines: DoseCardMedicine[];
		variant?: 'active' | 'next-up';
		lateLabel?: string | null; // e.g. "45 minutes late"
		busy?: boolean;
		canSnooze?: boolean;
		onTakeAll?: () => void;
		onToggleOne?: (doseLogId: string) => void;
		onSnooze?: () => void;
		onSkip?: () => void;
		onUndoAll?: () => void;
	}

	let {
		timeLabel,
		anchorLabel,
		anchorText,
		medicines,
		variant = 'active',
		lateLabel = null,
		busy = false,
		canSnooze = true,
		onTakeAll,
		onToggleOne,
		onSnooze,
		onSkip,
		onUndoAll
	}: Props = $props();

	let isGrouped = $derived(medicines.length > 1);
	let allResolved = $derived(
		medicines.length > 0 && medicines.every((m) => m.state === 'taken' || m.state === 'skipped')
	);
	let anyTaken = $derived(medicines.some((m) => m.state === 'taken'));

	function doseText(m: DoseCardMedicine): string {
		const unit = m.doseUnit.replace('_', ' ');
		return `${m.doseAmount} ${unit}${m.doseAmount === 1 ? '' : 's'}`;
	}
</script>

<div class="dose-card" class:next-up={variant === 'next-up'} class:late={Boolean(lateLabel)}>
	<div class="dose-head">
		<Pictogram id={TIME_ANCHOR_PIC[anchorLabel]} size={26} />
		<span class="t-title time-label">{timeLabel} · {anchorText}</span>
	</div>

	{#if variant === 'next-up'}
		<p class="note">Next up</p>
	{:else if lateLabel}
		<p class="note warn-note">{lateLabel}</p>
	{/if}

	{#each medicines as m (m.doseLogId)}
		<div class="med-row" class:resolved={m.state === 'taken' || m.state === 'skipped'}>
			{#if isGrouped && variant === 'active'}
				<button
					class="checkbox"
					class:checked={m.state === 'taken'}
					aria-pressed={m.state === 'taken'}
					aria-label="{m.name} taken"
					disabled={busy}
					onclick={() => onToggleOne?.(m.doseLogId)}
				></button>
			{/if}
			<div class="med-photo" style:background="var(--accent-{m.accentIndex})">
				<Pictogram id={DOSE_UNIT_GLYPH[m.doseUnit] ?? 'glyph-tablet'} size={26} />
			</div>
			<div class="med-info">
				<b>{m.name}{m.strength ? ` ${m.strength}` : ''}</b>
				<div class="dose">
					{#if m.state === 'skipped'}
						Skipped
					{:else}
						{#each Array(Math.max(1, Math.floor(m.doseAmount))) as _, i (i)}
							<Pictogram id={DOSE_UNIT_GLYPH[m.doseUnit] ?? 'glyph-tablet'} size={16} />
						{/each}
						{doseText(m)}
					{/if}
				</div>
			</div>
		</div>
	{/each}

	{#if variant === 'active'}
		{#if allResolved}
			<p class="resolved-note">{anyTaken ? 'Marked as taken.' : 'Marked as skipped.'}</p>
			{#if onUndoAll}
				<button class="btn btn-secondary" disabled={busy} onclick={onUndoAll}>Undo</button>
			{/if}
		{:else}
			<button class="btn btn-primary" disabled={busy} onclick={onTakeAll}>
				{isGrouped ? 'Taken all' : 'Taken'}
			</button>
			<div class="sub-actions">
				{#if canSnooze}
					<button class="link-action" disabled={busy} onclick={onSnooze}>Snooze 15 min</button>
				{/if}
				<button class="link-action muted" disabled={busy} onclick={onSkip}>Skip</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.dose-card {
		background: var(--state-now-bg);
		border: 2px solid var(--sage-700);
		border-radius: var(--r-card);
		padding: var(--sp-5);
	}
	.dose-card.late {
		border-color: var(--warn-border);
	}
	.dose-card.next-up {
		background: var(--surface);
		border: 1px solid var(--line-strong);
	}
	.dose-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin-bottom: var(--sp-3);
		color: var(--sage-700);
	}
	.time-label {
		font-size: var(--t-h2-size);
		line-height: var(--t-h2-line);
		color: var(--ink);
	}
	.note {
		margin: calc(-1 * var(--sp-2)) 0 var(--sp-3);
		font-size: var(--t-caption-size);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-2);
	}
	.note.warn-note {
		color: var(--warn-text);
	}
	.med-row {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-2) 0;
		border-bottom: 1px solid var(--sage-200);
	}
	.med-row:last-of-type {
		border-bottom: none;
	}
	.med-row.resolved {
		opacity: 0.6;
	}
	.checkbox {
		width: var(--tap-min);
		height: var(--tap-min);
		display: grid;
		place-items: center;
		margin: 0 calc(-1 * var(--sp-1));
		border: none;
		background: none;
		flex: 0 0 auto;
		cursor: pointer;
		padding: 0;
	}
	.checkbox::before {
		content: '';
		grid-area: 1 / 1;
		width: 26px;
		height: 26px;
		border-radius: 8px;
		border: 2px solid var(--line-strong);
		background: var(--surface);
	}
	.checkbox.checked::before {
		background: var(--state-done);
		border-color: var(--state-done);
	}
	.checkbox.checked::after {
		content: '✓';
		grid-area: 1 / 1;
		color: #fff;
		font-size: 15px;
		font-weight: 700;
	}
	.med-photo {
		width: 52px;
		height: 52px;
		border-radius: var(--r-inner);
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sage-800);
	}
	.med-info b {
		display: block;
		font-size: var(--t-body-size);
		line-height: var(--t-body-line);
	}
	.med-info .dose {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		margin-top: 2px;
		color: var(--sage-700);
		font-size: var(--t-caption-size);
	}
	.resolved-note {
		margin: var(--sp-3) 0 var(--sp-2);
		text-align: center;
		font-size: var(--t-body-size);
		color: var(--state-done);
		font-weight: 600;
	}
	.btn-primary {
		margin-top: var(--sp-4);
	}
	.sub-actions {
		display: flex;
		justify-content: center;
		gap: var(--sp-5);
		margin-top: var(--sp-2);
	}
	.link-action {
		background: none;
		border: none;
		cursor: pointer;
		font: 600 var(--t-caption-size) var(--font-sans);
		color: var(--sage-700);
		min-height: var(--tap-min);
		padding: 0 var(--sp-2);
	}
	.link-action.muted {
		color: var(--ink-2);
	}
	.link-action:disabled,
	.btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>

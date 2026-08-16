<!--
  The Now card — single or grouped medicines due in the current window.
  Mirrors design/preview/components-dose-card.html and screens-today.html
  exactly (same layout shape, same tokens); this is the Svelte version of
  those static specimens, not a redesign.

  Grouping + per-medicine partial completion, and the neutral (never red)
  language for the secondary actions, are both PRD requirements — see
  DESIGN.md rules 2 and the "Taken all" grouping note in docs/PRD.md §F3.
-->
<script lang="ts">
	import Pictogram from './Pictogram.svelte';
	import { DOSE_UNIT_GLYPH, TIME_ANCHOR_PIC } from '$lib/shared/instructionTags';
	import type { DoseUnit } from '$lib/shared/types';

	interface DoseCardMedicine {
		doseLogId: string;
		medicineId: string;
		name: string;
		strength: string | null;
		accentIndex: number;
		doseAmount: number;
		doseUnit: DoseUnit;
		checked?: boolean;
	}

	interface Props {
		timeLabel: string; // e.g. "8:00 AM"
		anchorLabel: 'morning' | 'afternoon' | 'evening' | 'night';
		anchorText: string; // e.g. "Morning"
		medicines: DoseCardMedicine[];
		onTakeAll: () => void;
		onToggleOne?: (doseLogId: string) => void;
		onSnooze: () => void;
		onSkip: () => void;
	}

	let {
		timeLabel,
		anchorLabel,
		anchorText,
		medicines,
		onTakeAll,
		onToggleOne,
		onSnooze,
		onSkip
	}: Props = $props();

	let isGrouped = $derived(medicines.length > 1);

	function doseText(m: DoseCardMedicine): string {
		const unit = m.doseUnit.replace('_', ' ');
		return `${m.doseAmount} ${unit}${m.doseAmount === 1 ? '' : 's'}`;
	}
</script>

<div class="dose-card">
	<div class="dose-head">
		<Pictogram id={TIME_ANCHOR_PIC[anchorLabel]} size={26} />
		<span class="t-title time-label">{timeLabel} · {anchorText}</span>
	</div>

	{#each medicines as m (m.doseLogId)}
		<div class="med-row">
			{#if isGrouped}
				<button
					class="checkbox"
					class:checked={m.checked}
					aria-pressed={m.checked}
					aria-label="{m.name} taken"
					onclick={() => onToggleOne?.(m.doseLogId)}
				></button>
			{/if}
			<div class="med-photo" style:background="var(--accent-{m.accentIndex})">
				<Pictogram id={DOSE_UNIT_GLYPH[m.doseUnit] ?? 'glyph-tablet'} size={26} />
			</div>
			<div class="med-info">
				<b>{m.name}{m.strength ? ` ${m.strength}` : ''}</b>
				<div class="dose">
					{#each Array(Math.max(1, Math.floor(m.doseAmount))) as _, i (i)}
						<Pictogram id={DOSE_UNIT_GLYPH[m.doseUnit] ?? 'glyph-tablet'} size={16} />
					{/each}
					{doseText(m)}
				</div>
			</div>
		</div>
	{/each}

	<button class="btn btn-primary" onclick={onTakeAll}>{isGrouped ? 'Taken all' : 'Taken'}</button>
	<div class="sub-actions">
		<button class="link-action" onclick={onSnooze}>Snooze 15 min</button>
		<button class="link-action muted" onclick={onSkip}>Skip</button>
	</div>
</div>

<style>
	.dose-card {
		background: var(--state-now-bg);
		border: 2px solid var(--sage-700);
		border-radius: var(--r-card);
		padding: var(--sp-5);
	}
	.dose-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin-bottom: var(--sp-3);
		color: var(--sage-700);
	}
	.time-label {
		font-size: 20px;
		color: var(--ink);
	}
	.med-row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: 10px 0;
		border-bottom: 1px solid var(--sage-200);
	}
	.med-row:last-of-type {
		border-bottom: none;
	}
	.checkbox {
		width: 26px;
		height: 26px;
		min-width: var(--tap-min);
		min-height: var(--tap-min);
		margin: calc((var(--tap-min) - 26px) / -2);
		border-radius: 8px;
		border: 2px solid var(--line-strong);
		background: var(--surface);
		flex: 0 0 auto;
		cursor: pointer;
	}
	.checkbox.checked {
		background: var(--state-done);
		border-color: var(--state-done);
		position: relative;
	}
	.checkbox.checked::after {
		content: '✓';
		color: #fff;
		font-size: 15px;
		font-weight: 700;
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
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
		font-size: 16px;
	}
	.med-info .dose {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 2px;
		color: var(--sage-700);
		font-size: 13.5px;
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
		font: 600 13px var(--font-sans);
		color: var(--sage-700);
		min-height: var(--tap-min);
		padding: 0 var(--sp-2);
	}
	.link-action.muted {
		color: var(--ink-2);
	}
</style>

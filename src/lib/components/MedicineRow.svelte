<!--
  Compact timeline row — mirrors design/preview/components-medicine-row.html.
  State is always carried by icon + label + color together (never color
  alone, per DESIGN.md rule) — "missed" uses the same neutral tokens as
  "upcoming", deliberately, never a red/alarm treatment.
-->
<script lang="ts">
	import type { DoseLogStatus } from '$lib/shared/types';

	interface Props {
		status: DoseLogStatus;
		title: string; // e.g. "6:00 AM · Vitamin D"
		subtitle: string; // e.g. "Taken at 6:04 AM" / "2 tablets" / "Not marked"
	}

	let { status, title, subtitle }: Props = $props();

	// dose_log has 5 statuses but the timeline only distinguishes 4 visual
	// states — 'snoozed' reads as upcoming-ish (it's on the way back to Now).
	const badge: Record<DoseLogStatus, { glyph: string; tag: string; cls: string }> = {
		taken: { glyph: '✓', tag: 'Done', cls: 'done' },
		pending: { glyph: '○', tag: 'Upcoming', cls: 'upcoming' },
		snoozed: { glyph: '○', tag: 'Upcoming', cls: 'upcoming' },
		skipped: { glyph: '–', tag: 'Skipped', cls: 'missed' },
		missed: { glyph: '–', tag: 'Missed', cls: 'missed' }
	};

	let b = $derived(badge[status]);
</script>

<div class="row" class:now={status === 'pending'}>
	<div class="icon-badge {b.cls}">{b.glyph}</div>
	<div class="info">
		<b>{title}</b>
		<span>{subtitle}</span>
	</div>
	<div class="tag {b.cls}">{b.tag}</div>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-4);
		background: var(--surface);
		border-radius: var(--r-inner);
		box-shadow: var(--shadow-1);
		margin-bottom: var(--sp-2);
	}
	.icon-badge {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
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
	.info {
		flex: 1;
		min-width: 0;
	}
	.info b {
		font-size: 14px;
		display: block;
	}
	.info span {
		font-size: 12px;
		color: var(--ink-2);
	}
	.tag {
		font-size: 11.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 4px 10px;
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
</style>

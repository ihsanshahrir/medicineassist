<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import DoseCard from '$lib/components/DoseCard.svelte';
	import MedicineRow from '$lib/components/MedicineRow.svelte';
	import Pictogram from '$lib/components/Pictogram.svelte';
	import { apiFetch } from '$lib/client/api';
	import { resolve } from '$app/paths';
	import { anchorFromIso, anchorText, formatTimeLabel } from '$lib/shared/formatTime';
	import type { DoseLogStatus, DoseUnit } from '$lib/shared/types';

	interface Occurrence {
		medicineId: string;
		medicineName: string;
		medicineStrength: string | null;
		accentIndex: number;
		doseAmount: number;
		doseUnit: DoseUnit;
		scheduledAt: string;
		anchorLabel: string | null;
		status: DoseLogStatus;
		takenAt: string | null;
	}
	interface TodayResponse {
		now: Occurrence[];
		timeline: Occurrence[];
		supplyWarnings: Array<{ medicineId: string; medicineName: string; daysRemaining: number }>;
	}

	let loading = $state(true);
	let data = $state<TodayResponse | null>(null);
	let pendingKeys = new SvelteSet<string>(); // in-flight actions, disables their controls

	const key = (o: Pick<Occurrence, 'medicineId' | 'scheduledAt'>) =>
		`${o.medicineId}::${o.scheduledAt}`;

	async function load() {
		loading = true;
		data = await apiFetch<TodayResponse>('/api/today');
		loading = false;
	}

	async function act(o: Occurrence, action: 'take' | 'skip' | 'snooze' | 'undo') {
		const k = key(o);
		pendingKeys.add(k);
		try {
			await apiFetch('/api/dose-logs', {
				method: 'POST',
				body: JSON.stringify({ medicineId: o.medicineId, scheduledAt: o.scheduledAt, action })
			});
			await load();
		} finally {
			pendingKeys.delete(k);
		}
	}

	async function takeAll(group: Occurrence[]) {
		await Promise.all(group.filter((o) => o.status === 'pending').map((o) => act(o, 'take')));
	}

	onMount(load);
</script>

<svelte:head>
	<title>Today · MedsAssist</title>
</svelte:head>

<main>
	{#if loading}
		<p class="t-body loading">Loading…</p>
	{:else if data}
		{#if data.now.length > 0}
			{@const firstTime = data.now[0].scheduledAt}
			{@const anchor = anchorFromIso(firstTime)}
			<DoseCard
				timeLabel={formatTimeLabel(firstTime)}
				anchorLabel={anchor}
				anchorText={anchorText(anchor)}
				medicines={data.now.map((o) => ({
					doseLogId: key(o),
					medicineId: o.medicineId,
					name: o.medicineName,
					strength: o.medicineStrength,
					accentIndex: o.accentIndex,
					doseAmount: o.doseAmount,
					doseUnit: o.doseUnit,
					checked: o.status !== 'pending'
				}))}
				onTakeAll={() => takeAll(data!.now)}
				onToggleOne={(k) => {
					const o = data!.now.find((x) => key(x) === k);
					if (o) act(o, o.status === 'pending' ? 'take' : 'undo');
				}}
				onSnooze={() =>
					data!.now.filter((o) => o.status === 'pending').forEach((o) => act(o, 'snooze'))}
				onSkip={() =>
					data!.now.filter((o) => o.status === 'pending').forEach((o) => act(o, 'skip'))}
			/>
		{/if}

		{#if data.timeline.length > 0}
			<h2 class="t-h2 section-title">Today</h2>
			{#each data.timeline as o (key(o))}
				<MedicineRow
					status={o.status}
					title="{formatTimeLabel(o.scheduledAt)} · {o.medicineName}"
					subtitle={o.status === 'taken' && o.takenAt
						? `Taken at ${formatTimeLabel(o.takenAt)}`
						: o.status === 'missed'
							? 'Not marked'
							: o.status === 'skipped'
								? 'Skipped'
								: o.status === 'snoozed'
									? 'Snoozed'
									: `${o.doseAmount} ${o.doseUnit}${o.doseAmount === 1 ? '' : 's'}`}
				/>
			{/each}
		{/if}

		{#each data.supplyWarnings as w (w.medicineId)}
			<div class="warn-banner">
				<Pictogram id="pic-keep-refrigerated" label="Low supply" size={22} />
				<div>
					<b>{w.medicineName} running low</b>
					<span>{w.daysRemaining} days remaining</span>
				</div>
			</div>
		{/each}

		{#if data.now.length === 0 && data.timeline.length === 0}
			<div class="empty">
				<p class="t-body-lg">No medicines yet.</p>
				<a class="btn btn-primary" href={resolve('/medicines/add')}>Add your first medicine</a>
			</div>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
	}
	.loading {
		text-align: center;
		color: var(--ink-2);
		padding: var(--sp-10) 0;
	}
	.section-title {
		margin: var(--sp-6) 0 var(--sp-2);
	}
	.warn-banner {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		background: var(--warn-bg);
		border: 1px solid var(--warn-border);
		border-radius: var(--r-inner);
		padding: var(--sp-3) var(--sp-4);
		color: var(--warn-text);
		margin-top: var(--sp-3);
	}
	.warn-banner b {
		display: block;
		font-size: 13.5px;
	}
	.warn-banner span {
		font-size: 11.5px;
		color: var(--ink-2);
	}
	.empty {
		text-align: center;
		padding: var(--sp-16) var(--sp-4);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-4);
	}
	.empty p {
		color: var(--ink-2);
	}
	.empty .btn-primary {
		width: auto;
		display: inline-flex;
		text-decoration: none;
		padding: 0 var(--sp-6);
	}
</style>

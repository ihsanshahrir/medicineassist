<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import DoseCard from '$lib/components/DoseCard.svelte';
	import MedicineRow from '$lib/components/MedicineRow.svelte';
	import Pictogram from '$lib/components/Pictogram.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Optimistic local toggle for the grouped checkboxes — real persistence
	// (POST /api/dose-logs) lands in M2; this just proves the interaction shape.
	// Kept separate from `data` (rather than seeding $state from it) so this
	// stays reactive to `data` on navigation/invalidation instead of freezing
	// at first render. SvelteSet (not a plain Set) so in-place add/delete is
	// itself reactive, no reassignment needed.
	let checkedIds = new SvelteSet<string>();
	let medicines = $derived(
		data.now.medicines.map((m) => ({ ...m, checked: checkedIds.has(m.doseLogId) }))
	);

	function toggleOne(doseLogId: string) {
		if (checkedIds.has(doseLogId)) {
			checkedIds.delete(doseLogId);
		} else {
			checkedIds.add(doseLogId);
		}
	}
	function takeAll() {
		checkedIds.clear();
		for (const m of data.now.medicines) checkedIds.add(m.doseLogId);
	}
</script>

<svelte:head>
	<title>Today · MedsAssist</title>
</svelte:head>

<main>
	<DoseCard
		timeLabel={data.now.timeLabel}
		anchorLabel={data.now.anchorLabel}
		anchorText={data.now.anchorText}
		{medicines}
		onTakeAll={takeAll}
		onToggleOne={toggleOne}
		onSnooze={() => {}}
		onSkip={() => {}}
	/>

	<h2 class="t-h2 section-title">Today</h2>
	{#each data.timeline as row (row.title)}
		<MedicineRow status={row.status} title={row.title} subtitle={row.subtitle} />
	{/each}

	{#each data.supplyWarnings as w (w.medicineId)}
		<div class="warn-banner">
			<Pictogram id="pic-keep-refrigerated" label="Low supply" size={22} />
			<div>
				<b>{w.medicineName} running low</b>
				<span>{w.daysRemaining} days remaining</span>
			</div>
		</div>
	{/each}
</main>

<style>
	main {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
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
	}
	.warn-banner b {
		display: block;
		font-size: 13.5px;
	}
	.warn-banner span {
		font-size: 11.5px;
		color: var(--ink-2);
	}
</style>

<!--
  OCR wizard (M3), Step 4 — Schedule. Mirrors design/preview/screens-add-schedule.html
  and reuses MedicineForm's same schedule-building UI/patterns (not extracted
  into a shared component — MedicineForm's version is tightly coupled to its
  own submit flow, and this wizard step needs its own PUT-then-navigate
  submit instead). Dose/frequency carried forward from the Confirm step (via
  query params) seed sensible defaults here rather than forcing a re-type.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import WizardProgress from '$lib/components/WizardProgress.svelte';
	import Pictogram from '$lib/components/Pictogram.svelte';
	import { apiFetch } from '$lib/client/api';
	import { TIME_ANCHOR_PIC } from '$lib/shared/instructionTags';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface AnchorTimes {
		morning: string;
		afternoon: string;
		evening: string;
		night: string;
	}
	type Anchor = keyof AnchorTimes;
	const ANCHORS: Anchor[] = ['morning', 'afternoon', 'evening', 'night'];
	const DEFAULT_ANCHOR_TIMES: AnchorTimes = {
		morning: '08:00',
		afternoon: '13:00',
		evening: '19:00',
		night: '22:00'
	};

	const KNOWN_UNITS = ['tablet', 'capsule', 'half_tablet', 'ml', 'puff', 'drop'];
	const FREQ_ANCHORS: Record<number, Anchor[]> = {
		1: ['morning'],
		2: ['morning', 'evening'],
		3: ['morning', 'afternoon', 'evening'],
		4: ['morning', 'afternoon', 'evening', 'night']
	};

	// One-time seed from the query params the Confirm step forwarded — this id
	// doesn't change again while this page is mounted, so reading `data` here
	// is deliberate (see MedicineForm.svelte's identical `seed` pattern).
	const seed = untrack(() => {
		const parsedAmount = data.doseAmount ? Number(data.doseAmount) : NaN;
		const parsedFreq = data.freq ? Number(data.freq) : NaN;
		return {
			doseAmount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1,
			doseUnit: data.doseUnit && KNOWN_UNITS.includes(data.doseUnit) ? data.doseUnit : 'tablet',
			anchors: FREQ_ANCHORS[parsedFreq] ?? ['morning']
		};
	});

	const today = new Date().toISOString().slice(0, 10);
	let doseAmount = $state(seed.doseAmount);
	let doseUnit = $state(seed.doseUnit);
	let repeatType = $state<'daily' | 'every_n_days' | 'weekdays'>('daily');
	let repeatIntervalDays = $state(2);
	let weekdaysMask = $state(0b0011111);
	let startDate = $state(today);
	let selectedAnchors = $state(new Set<Anchor>(seed.anchors));
	let anchorTimes = $state<AnchorTimes>({ ...DEFAULT_ANCHOR_TIMES });

	function toggleAnchor(a: Anchor) {
		if (selectedAnchors.has(a)) selectedAnchors.delete(a);
		else selectedAnchors.add(a);
	}
	function toggleWeekday(bit: number) {
		weekdaysMask = weekdaysMask ^ (1 << bit);
	}
	const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	let saving = $state(false);
	let error = $state('');

	async function submit() {
		if (selectedAnchors.size === 0) {
			error = 'Pick at least one time of day.';
			return;
		}
		error = '';
		saving = true;
		try {
			await apiFetch(`/api/medicines/${data.id}/schedule`, {
				method: 'PUT',
				body: JSON.stringify({
					doseAmount,
					doseUnit,
					repeatType,
					repeatIntervalDays: repeatType === 'every_n_days' ? repeatIntervalDays : null,
					weekdaysMask: repeatType === 'weekdays' ? weekdaysMask : null,
					startDate,
					times: [...selectedAnchors].map((a) => ({ timeLocal: anchorTimes[a], anchorLabel: a }))
				})
			});
			window.location.href = `/medicines/add/supply?id=${data.id}`;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>When do you take it? · MedsAssist</title>
</svelte:head>

<main>
	<WizardProgress step={4} />
	<h1 class="t-title">When do you take it?</h1>

	<section>
		<span class="t-label">Dose per intake</span>
		<div class="stepper">
			<button
				type="button"
				aria-label="Decrease dose"
				onclick={() => (doseAmount = Math.max(0.5, doseAmount - 0.5))}>–</button
			>
			<span class="t-title dose-val">{doseAmount}</span>
			<button type="button" aria-label="Increase dose" onclick={() => (doseAmount += 0.5)}>+</button
			>
			<select class="unit-select" bind:value={doseUnit}>
				<option value="tablet">tablet(s)</option>
				<option value="capsule">capsule(s)</option>
				<option value="half_tablet">half tablet</option>
				<option value="ml">mL</option>
				<option value="puff">puff(s)</option>
				<option value="drop">drop(s)</option>
			</select>
		</div>
	</section>

	<section>
		<span class="t-label">Time of day</span>
		<div class="anchor-grid">
			{#each ANCHORS as a (a)}
				<div class="anchor" class:active={selectedAnchors.has(a)}>
					<button type="button" class="anchor-toggle" onclick={() => toggleAnchor(a)}>
						<Pictogram id={TIME_ANCHOR_PIC[a]} size={22} />
						<span class="t-caption">{a[0].toUpperCase() + a.slice(1)}</span>
					</button>
					{#if selectedAnchors.has(a)}
						<input type="time" class="time-input" bind:value={anchorTimes[a]} />
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<section>
		<span class="t-label">Repeat</span>
		<div class="segmented">
			<button
				type="button"
				class:active={repeatType === 'daily'}
				onclick={() => (repeatType = 'daily')}
			>
				Every day
			</button>
			<button
				type="button"
				class:active={repeatType === 'every_n_days'}
				onclick={() => (repeatType = 'every_n_days')}
			>
				Every N days
			</button>
			<button
				type="button"
				class:active={repeatType === 'weekdays'}
				onclick={() => (repeatType = 'weekdays')}
			>
				Weekdays
			</button>
		</div>

		{#if repeatType === 'every_n_days'}
			<div class="n-days">
				<span class="t-body">Every</span>
				<input type="number" class="text-input n-input" min="2" bind:value={repeatIntervalDays} />
				<span class="t-body">days</span>
			</div>
		{:else if repeatType === 'weekdays'}
			<div class="weekday-grid">
				{#each WEEKDAY_LABELS as label, bit (label)}
					<button
						type="button"
						class="weekday-btn"
						class:active={((weekdaysMask >> bit) & 1) === 1}
						onclick={() => toggleWeekday(bit)}
					>
						{label}
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<section>
		<label class="t-label" for="start-date">Start date</label>
		<input id="start-date" type="date" class="text-input" bind:value={startDate} />
	</section>

	{#if error}<p class="error t-caption">{error}</p>{/if}
	<button class="btn btn-primary" disabled={saving} onclick={submit}>
		{saving ? 'Saving…' : 'Continue'}
	</button>
</main>

<style>
	main {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
	}
	section {
		margin-bottom: var(--sp-6);
	}
	.t-label {
		display: block;
		margin: 0 0 var(--sp-2);
	}
	.text-input {
		width: 100%;
		min-height: var(--tap-min);
		border-radius: var(--r-input);
		border: 1.5px solid var(--line-strong);
		background: var(--surface);
		padding: 0 var(--sp-4);
		font-size: var(--t-body-size);
		color: var(--ink);
		font-family: var(--font-sans);
	}
	.stepper {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		background: var(--surface);
		border-radius: var(--r-input);
		padding: var(--sp-2) var(--sp-4);
		box-shadow: var(--shadow-1);
	}
	.stepper button {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		border: 1.5px solid var(--line-strong);
		background: var(--surface);
		font-size: 18px;
		font-weight: 700;
		color: var(--sage-700);
		cursor: pointer;
	}
	.dose-val {
		font-size: 20px;
		min-width: 28px;
		text-align: center;
	}
	.unit-select {
		margin-left: auto;
		min-height: var(--tap-min);
		border: 1.5px solid var(--line-strong);
		border-radius: var(--r-input);
		background: var(--surface);
		padding: 0 var(--sp-2);
		font-family: var(--font-sans);
	}
	.anchor-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--sp-2);
	}
	.anchor {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.anchor-toggle {
		background: var(--surface);
		border: 1.5px solid var(--line-strong);
		border-radius: var(--r-inner);
		padding: var(--sp-3) var(--sp-1);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		color: var(--sage-700);
		min-height: var(--tap-min);
		width: 100%;
	}
	.anchor.active .anchor-toggle {
		background: var(--sage-100);
		border-color: var(--sage-700);
	}
	.time-input {
		min-height: 40px;
		border-radius: 8px;
		border: 1.5px solid var(--line-strong);
		text-align: center;
		font-family: var(--font-sans);
	}
	.segmented {
		display: flex;
		background: var(--surface-sunk);
		border-radius: var(--r-input);
		padding: 4px;
		gap: 4px;
	}
	.segmented button {
		flex: 1;
		min-height: 40px;
		border: none;
		border-radius: 8px;
		background: transparent;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-2);
		cursor: pointer;
		font-family: var(--font-sans);
	}
	.segmented button.active {
		background: var(--surface);
		color: var(--sage-800);
		box-shadow: var(--shadow-1);
	}
	.n-days {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin-top: var(--sp-3);
	}
	.n-input {
		width: 72px;
		text-align: center;
	}
	.weekday-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
		margin-top: var(--sp-3);
	}
	.weekday-btn {
		min-height: 44px;
		border-radius: 8px;
		border: 1.5px solid var(--line-strong);
		background: var(--surface);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-2);
		cursor: pointer;
	}
	.weekday-btn.active {
		background: var(--sage-100);
		border-color: var(--sage-700);
		color: var(--sage-800);
	}
	.error {
		color: var(--danger-text);
		margin-bottom: var(--sp-3);
	}
	.btn {
		width: 100%;
	}
</style>

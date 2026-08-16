<!--
  Manual entry (M2) — one form, all fields at once. This is deliberately
  NOT the staged OCR wizard from docs/PRD.md (capture → confirm → pill photo
  → schedule → supply): that multi-step flow exists because a camera capture
  step forces staging. Typing everything in doesn't, so one form is simpler
  and faster for the "manual entry" path specifically. The OCR wizard (M3)
  is a separate flow that happens to call the same PUT .../schedule endpoint
  as its own step — and lands back on this form (mode="draft") if OCR fails
  outright, per the PRD's "never a dead end" requirement.
-->
<script module lang="ts">
	import type { InstructionTag, WarningTag } from '$lib/shared/types';

	export interface MedicineFormInitialData {
		name: string;
		strength: string;
		form: string;
		whatFor: string;
		instructionsText: string;
		instructionTags: InstructionTag[];
		warningTags: WarningTag[];
		notes: string;
		supplyCount: number | null;
		schedule: {
			doseAmount: number;
			doseUnit: string;
			repeatType: 'daily' | 'every_n_days' | 'weekdays';
			repeatIntervalDays: number | null;
			weekdaysMask: number | null;
			startDate: string;
			endDate: string | null;
			times: Array<{ timeLocal: string; anchorLabel: string | null }>;
		} | null;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import Pictogram from './Pictogram.svelte';
	import { apiFetch } from '$lib/client/api';
	import {
		INSTRUCTION_TAG_META,
		WARNING_TAG_META,
		TIME_ANCHOR_PIC
	} from '$lib/shared/instructionTags';

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

	interface Props {
		// 'draft' is the OCR wizard's "drop to manual form" fallback: a draft
		// medicine (is_draft=1) already exists with a label photo attached, so
		// this PATCHes + finalizes it instead of creating a new row.
		mode: 'add' | 'edit' | 'draft';
		medicineId?: string;
		initial?: MedicineFormInitialData;
	}
	let { mode, medicineId, initial }: Props = $props();

	const today = new Date().toISOString().slice(0, 10);

	// `initial` is fetched once by the parent and doesn't change again while
	// this component is mounted (edit/+page.svelte gates rendering until it's
	// ready) — untrack() tells Svelte that reading it here is a deliberate
	// one-time seed for editable local state, not a missing reactive dependency.
	const seed = untrack(() => ({
		name: initial?.name ?? '',
		strength: initial?.strength ?? '',
		form: initial?.form ?? 'tablet',
		whatFor: initial?.whatFor ?? '',
		instructionsText: initial?.instructionsText ?? '',
		notes: initial?.notes ?? '',
		instructionTags: initial?.instructionTags ?? [],
		warningTags: initial?.warningTags ?? [],
		supplyCount: initial?.supplyCount ?? null,
		doseAmount: initial?.schedule?.doseAmount ?? 1,
		doseUnit: initial?.schedule?.doseUnit ?? 'tablet',
		repeatType: initial?.schedule?.repeatType ?? ('daily' as const),
		repeatIntervalDays: initial?.schedule?.repeatIntervalDays ?? 2,
		weekdaysMask: initial?.schedule?.weekdaysMask ?? 0b0011111, // Mon-Fri default
		startDate: initial?.schedule?.startDate ?? today,
		endDate: initial?.schedule?.endDate ?? '',
		times: initial?.schedule?.times ?? []
	}));

	let name = $state(seed.name);
	let strength = $state(seed.strength);
	let form = $state(seed.form);
	let whatFor = $state(seed.whatFor);
	let instructionsText = $state(seed.instructionsText);
	let notes = $state(seed.notes);
	let instructionTags = $state(new Set<string>(seed.instructionTags));
	let warningTags = $state(new Set<string>(seed.warningTags));
	let supplyCount = $state<number | null>(seed.supplyCount);

	let doseAmount = $state(seed.doseAmount);
	let doseUnit = $state(seed.doseUnit);
	let repeatType = $state<'daily' | 'every_n_days' | 'weekdays'>(seed.repeatType);
	let repeatIntervalDays = $state(seed.repeatIntervalDays);
	let weekdaysMask = $state(seed.weekdaysMask);
	let startDate = $state(seed.startDate);
	let endDate = $state<string>(seed.endDate);

	const initialAnchors = new Set(
		seed.times
			.map((t) => t.anchorLabel)
			.filter((a): a is Anchor => !!a && a in DEFAULT_ANCHOR_TIMES)
	);
	let selectedAnchors = $state(new Set<Anchor>(initialAnchors.size ? initialAnchors : ['morning']));
	let anchorTimes = $state<AnchorTimes>({ ...DEFAULT_ANCHOR_TIMES });
	for (const t of seed.times) {
		if (t.anchorLabel && t.anchorLabel in anchorTimes) {
			anchorTimes[t.anchorLabel as Anchor] = t.timeLocal;
		}
	}

	let saving = $state(false);
	let error = $state('');

	function toggleTag(set: Set<string>, tag: string) {
		if (set.has(tag)) {
			set.delete(tag);
		} else {
			set.add(tag);
		}
	}
	function toggleAnchor(a: Anchor) {
		if (selectedAnchors.has(a)) {
			selectedAnchors.delete(a);
		} else {
			selectedAnchors.add(a);
		}
	}
	function toggleWeekday(bit: number) {
		weekdaysMask = weekdaysMask ^ (1 << bit);
	}

	const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	async function submit(e: Event) {
		e.preventDefault();
		if (!name.trim() || selectedAnchors.size === 0) {
			error = 'Enter a name and pick at least one time.';
			return;
		}
		error = '';
		saving = true;

		const schedule = {
			doseAmount,
			doseUnit,
			repeatType,
			repeatIntervalDays: repeatType === 'every_n_days' ? repeatIntervalDays : null,
			weekdaysMask: repeatType === 'weekdays' ? weekdaysMask : null,
			startDate,
			endDate: endDate || null,
			times: [...selectedAnchors].map((a) => ({ timeLocal: anchorTimes[a], anchorLabel: a }))
		};

		const payload = {
			name: name.trim(),
			strength: strength || null,
			form,
			whatFor: whatFor || null,
			instructionsText: instructionsText || null,
			instructionTags: [...instructionTags],
			warningTags: [...warningTags],
			notes: notes || null,
			supplyCount
		};

		try {
			let id = medicineId;
			if (mode === 'add') {
				const res = await apiFetch<{ medicine: { id: string } }>('/api/medicines', {
					method: 'POST',
					body: JSON.stringify({ ...payload, schedule })
				});
				id = res.medicine.id;
			} else {
				await apiFetch(`/api/medicines/${medicineId}`, {
					method: 'PATCH',
					body: JSON.stringify(payload)
				});
				await apiFetch(`/api/medicines/${medicineId}/schedule`, {
					method: 'PUT',
					body: JSON.stringify(schedule)
				});
				if (mode === 'draft') {
					await apiFetch(`/api/medicines/${medicineId}/finish`, { method: 'POST' });
				}
			}
			window.location.href = `/medicines/${id}`;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
			saving = false;
		}
	}
</script>

<form onsubmit={submit}>
	<section>
		<h2 class="t-h2">Medicine</h2>
		<label class="t-label" for="name">Name</label>
		<input id="name" class="text-input" bind:value={name} required />

		<label class="t-label" for="strength">Strength</label>
		<input id="strength" class="text-input" placeholder="e.g. 500mg" bind:value={strength} />

		<label class="t-label" for="form">Form</label>
		<select id="form" class="text-input" bind:value={form}>
			<option value="tablet">Tablet</option>
			<option value="capsule">Capsule</option>
			<option value="syrup">Syrup</option>
			<option value="inhaler">Inhaler</option>
			<option value="drops">Drops</option>
			<option value="other">Other</option>
		</select>

		<label class="t-label" for="whatFor">What it's for</label>
		<input
			id="whatFor"
			class="text-input"
			placeholder="e.g. Helps control blood sugar"
			bind:value={whatFor}
		/>
	</section>

	<section>
		<h2 class="t-h2">How to take it</h2>
		<label class="t-label" for="instructions">Instructions</label>
		<input id="instructions" class="text-input" bind:value={instructionsText} />

		<div class="tag-grid">
			{#each Object.entries(INSTRUCTION_TAG_META) as [tag, meta] (tag)}
				<button
					type="button"
					class="tag-chip"
					class:active={instructionTags.has(tag)}
					onclick={() => toggleTag(instructionTags, tag)}
				>
					<Pictogram id={meta.picId} size={22} />
					<span>{meta.en}</span>
				</button>
			{/each}
		</div>

		<label class="t-label warn-label" for="warn-grid">Warnings</label>
		<div class="tag-grid" id="warn-grid">
			{#each Object.entries(WARNING_TAG_META) as [tag, meta] (tag)}
				<button
					type="button"
					class="tag-chip warn"
					class:active={warningTags.has(tag)}
					onclick={() => toggleTag(warningTags, tag)}
				>
					<Pictogram id={meta.picId} size={22} />
					<span>{meta.en}</span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="t-h2">Schedule</h2>
		<label class="t-label" for="dose-stepper">Dose per intake</label>
		<div class="stepper" id="dose-stepper">
			<button type="button" onclick={() => (doseAmount = Math.max(0.5, doseAmount - 0.5))}>–</button
			>
			<span class="t-title dose-val">{doseAmount}</span>
			<button type="button" onclick={() => (doseAmount += 0.5)}>+</button>
			<select class="unit-select" bind:value={doseUnit}>
				<option value="tablet">tablet(s)</option>
				<option value="capsule">capsule(s)</option>
				<option value="half_tablet">half tablet</option>
				<option value="ml">mL</option>
				<option value="puff">puff(s)</option>
				<option value="drop">drop(s)</option>
			</select>
		</div>

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

		<label class="t-label" for="start-date">Start date</label>
		<input id="start-date" type="date" class="text-input" bind:value={startDate} />
	</section>

	<section>
		<h2 class="t-h2">Supply</h2>
		<label class="t-label" for="supply">How many do you have? (optional)</label>
		<input
			id="supply"
			type="number"
			class="text-input"
			min="0"
			value={supplyCount ?? ''}
			oninput={(e) => (supplyCount = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
		/>
	</section>

	<section>
		<h2 class="t-h2">Notes</h2>
		<textarea class="text-input notes" bind:value={notes} rows="3"></textarea>
	</section>

	{#if error}<p class="error t-caption">{error}</p>{/if}
	<button class="btn btn-primary" type="submit" disabled={saving}>
		{saving ? 'Saving…' : mode === 'add' ? 'Add medicine' : 'Save changes'}
	</button>
</form>

<style>
	form {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-12);
		display: flex;
		flex-direction: column;
	}
	section {
		margin-bottom: var(--sp-8);
	}
	label,
	.t-label {
		display: block;
		margin: var(--sp-4) 0 var(--sp-2);
	}
	.warn-label {
		margin-top: var(--sp-5);
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
	select.text-input {
		appearance: auto;
	}
	.notes {
		padding: var(--sp-3) var(--sp-4);
		resize: vertical;
	}
	.tag-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--sp-2);
	}
	.tag-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		background: var(--surface);
		border: 1.5px solid var(--line-strong);
		border-radius: var(--r-inner);
		padding: var(--sp-3) var(--sp-1);
		color: var(--ink-2);
		cursor: pointer;
		min-height: var(--tap-min);
		font-family: var(--font-sans);
	}
	.tag-chip span {
		font-size: 11.5px;
		font-weight: 600;
		text-align: center;
	}
	.tag-chip.active {
		background: var(--sage-100);
		border-color: var(--sage-700);
		color: var(--sage-800);
	}
	.tag-chip.warn.active {
		background: var(--warn-bg);
		border-color: var(--warn-border);
		color: var(--warn-text);
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
		font-family: var(--font-sans);
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
</style>

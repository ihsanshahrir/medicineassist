<script lang="ts">
	import { onMount } from 'svelte';
	import Pictogram from '$lib/components/Pictogram.svelte';
	import { apiFetch } from '$lib/client/api';
	import { resolve } from '$app/paths';
	import {
		INSTRUCTION_TAG_META,
		WARNING_TAG_META,
		MEDICINE_FORM_GLYPH,
		DOSE_UNIT_GLYPH,
		tagLabel
	} from '$lib/shared/instructionTags';
	import { daysBetween, estimateAvgDailyDose } from '$lib/shared/scheduleOccurrence';
	import { userSettings } from '$lib/stores/userSettings.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface MedicineDetail {
		id: string;
		name: string;
		strength: string | null;
		form: string;
		what_for: string | null;
		instructions_text: string | null;
		instruction_tags: string;
		warning_tags: string;
		notes: string | null;
		accent_index: number;
		pill_photo_key: string | null;
		supply_count: number | null;
		last_refill_amount: number | null;
	}
	interface ScheduleDetail {
		dose_amount: number;
		dose_unit: string;
		repeat_type: 'daily' | 'every_n_days' | 'weekdays';
		repeat_interval_days: number | null;
		weekdays_mask: number | null;
		start_date: string;
		end_date: string | null;
		times: Array<{ time_local: string; anchor_label: string | null }>;
	}

	let loading = $state(true);
	let medicine = $state<MedicineDetail | null>(null);
	let schedule = $state<ScheduleDetail | null>(null);
	let deleting = $state(false);

	async function load() {
		loading = true;
		const res = await apiFetch<{ medicine: MedicineDetail; schedule: ScheduleDetail | null }>(
			`/api/medicines/${data.id}`
		);
		medicine = res.medicine;
		schedule = res.schedule;
		loading = false;
	}
	onMount(load);

	const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	function repeatSummary(s: ScheduleDetail): string {
		if (s.repeat_type === 'daily') return 'Every day';
		if (s.repeat_type === 'every_n_days') return `Every ${s.repeat_interval_days} days`;
		if (s.repeat_type === 'weekdays') {
			const mask = s.weekdays_mask ?? 0;
			const days = WEEKDAY_LABELS.filter((_, bit) => (mask >> bit) & 1);
			return days.join(', ') || 'No days selected';
		}
		return '';
	}

	// Local (browser) calendar date, not UTC — v1 is MYT-only per the PRD, and
	// this is a display-only estimate, not the safety-critical scheduling math
	// (that's server-side and uses the user's stored tz_offset_minutes).
	function todayDateStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function daysRemainingEstimate(supplyCount: number, s: ScheduleDetail): number | null {
		const avgDaily = estimateAvgDailyDose({
			doseAmount: s.dose_amount,
			timesPerDay: s.times.length,
			repeatType: s.repeat_type,
			repeatIntervalDays: s.repeat_interval_days,
			weekdaysMask: s.weekdays_mask
		});
		return avgDaily > 0 ? Math.floor(supplyCount / avgDaily) : null;
	}

	interface CourseProgress {
		dayIndex: number;
		totalDays: number;
		percent: number;
	}
	function courseProgress(s: ScheduleDetail): CourseProgress | null {
		if (!s.end_date) return null;
		const totalDays = daysBetween(s.start_date, s.end_date) + 1;
		if (totalDays <= 0) return null;
		const elapsed = daysBetween(s.start_date, todayDateStr()) + 1;
		const dayIndex = Math.min(totalDays, Math.max(1, elapsed));
		return { dayIndex, totalDays, percent: Math.round((dayIndex / totalDays) * 100) };
	}

	async function deleteMedicine() {
		if (!confirm(`Delete ${medicine?.name}? This can't be undone.`)) return;
		deleting = true;
		await apiFetch(`/api/medicines/${data.id}`, { method: 'DELETE' });
		window.location.href = '/medicines';
	}
</script>

<svelte:head>
	<title>{medicine?.name ?? 'Medicine'} · MedsAssist</title>
</svelte:head>

<main>
	{#if loading}
		<p class="t-body loading">Loading…</p>
	{:else if medicine}
		<div class="hero">
			{#if medicine.pill_photo_key}
				<img
					class="photo pill-photo"
					src="/api/photos/{medicine.pill_photo_key}"
					alt="{medicine.name} pill"
				/>
			{:else}
				<div class="photo" style:background="var(--accent-{medicine.accent_index})">
					<Pictogram id={MEDICINE_FORM_GLYPH[medicine.form] ?? 'glyph-tablet'} size={44} />
				</div>
			{/if}
			<div class="hero-info">
				<b class="t-title">{medicine.name}</b>
				<span class="t-body-lg muted">
					{medicine.strength ? `${medicine.strength} · ` : ''}{medicine.form}
				</span>
			</div>
		</div>

		{#if medicine.what_for}
			<div class="section">
				<h3 class="t-caption label">What it's for</h3>
				<div class="what-for surface-card">{medicine.what_for}</div>
			</div>
		{/if}

		{#if JSON.parse(medicine.instruction_tags).length > 0 || medicine.instructions_text}
			<div class="section">
				<h3 class="t-caption label">How to take it</h3>
				{#if JSON.parse(medicine.instruction_tags).length > 0}
					<div class="tile-grid">
						{#each JSON.parse(medicine.instruction_tags) as tag (tag)}
							{@const meta = INSTRUCTION_TAG_META[tag as keyof typeof INSTRUCTION_TAG_META]}
							{#if meta}
								<div class="tile surface-card">
									<Pictogram id={meta.picId} size={28} />
									<span>{tagLabel(meta, userSettings.language)}</span>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
				{#if medicine.instructions_text}
					<p class="t-body free-text">{medicine.instructions_text}</p>
				{/if}
			</div>
		{/if}

		{#if JSON.parse(medicine.warning_tags).length > 0}
			<div class="section">
				<h3 class="t-caption label">Be careful</h3>
				<div class="warn-panel">
					{#each JSON.parse(medicine.warning_tags) as tag (tag)}
						{@const meta = WARNING_TAG_META[tag as keyof typeof WARNING_TAG_META]}
						{#if meta}
							<div class="warn-row">
								<Pictogram id={meta.picId} size={24} />
								<span>{tagLabel(meta, userSettings.language)}</span>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<div class="section">
			<h3 class="t-caption label">Supply</h3>
			<div class="supply-card surface-card">
				{#if medicine.supply_count !== null}
					{@const days = schedule ? daysRemainingEstimate(medicine.supply_count, schedule) : null}
					{@const fillPercent = medicine.last_refill_amount
						? Math.min(100, Math.round((medicine.supply_count / medicine.last_refill_amount) * 100))
						: null}
					<div class="supply-row">
						<b class="t-body-lg">
							{medicine.supply_count} left{days !== null
								? ` · ~${days} day${days === 1 ? '' : 's'}`
								: ''}
						</b>
						<a class="btn-text" href={resolve('/medicines/[id]/refill', { id: data.id })}>Refill</a>
					</div>
					{#if fillPercent !== null}
						<div class="meter-track">
							<div
								class="meter-fill"
								class:meter-low={days !== null && days <= 7}
								style:width="{fillPercent}%"
							></div>
						</div>
					{/if}
				{:else}
					<div class="supply-row">
						<b class="t-body-lg">Not tracked</b>
						<a class="btn-text" href={resolve('/medicines/[id]/refill', { id: data.id })}>Refill</a>
					</div>
				{/if}
			</div>
		</div>

		{#if schedule}
			{@const course = courseProgress(schedule)}
			{#if course}
				<div class="section">
					<h3 class="t-caption label">Course progress</h3>
					<div class="supply-card surface-card">
						<div class="supply-row">
							<b class="t-body-lg">Day {course.dayIndex} of {course.totalDays}</b>
						</div>
						<div class="meter-track">
							<div class="meter-fill" style:width="{course.percent}%"></div>
						</div>
						<p class="t-caption course-note">Finish the full course even if you feel better</p>
					</div>
				</div>
			{/if}
		{/if}

		{#if schedule}
			<div class="section">
				<h3 class="t-caption label">Schedule</h3>
				<div class="schedule-card surface-card">
					<div class="dose-line">
						{#each Array(Math.max(1, Math.floor(schedule.dose_amount))) as _, i (i)}
							<Pictogram id={DOSE_UNIT_GLYPH[schedule.dose_unit] ?? 'glyph-tablet'} size={18} />
						{/each}
						<span class="t-body">{schedule.dose_amount} {schedule.dose_unit.replace('_', ' ')}</span
						>
					</div>
					<p class="t-caption">{repeatSummary(schedule)}</p>
					<p class="t-caption">
						{schedule.times.map((t) => t.time_local).join(', ')}
					</p>
				</div>
			</div>
		{/if}

		{#if medicine.notes}
			<div class="section">
				<h3 class="t-caption label">Notes</h3>
				<div class="what-for surface-card">{medicine.notes}</div>
			</div>
		{/if}

		<div class="actions">
			<a class="btn btn-secondary" href={resolve('/medicines/[id]/edit', { id: data.id })}>Edit</a>
			<button class="btn btn-destructive" onclick={deleteMedicine} disabled={deleting}>
				{deleting ? 'Deleting…' : 'Delete'}
			</button>
		</div>
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
	.hero {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
	}
	.photo {
		width: 84px;
		height: 84px;
		border-radius: var(--r-card);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sage-800);
		flex: 0 0 auto;
	}
	.pill-photo {
		object-fit: cover;
	}
	.hero-info b {
		display: block;
	}
	.muted {
		color: var(--ink-2);
	}
	.section {
		margin-top: var(--sp-6);
	}
	.label {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink-3);
		margin-bottom: var(--sp-2);
	}
	.what-for {
		padding: var(--sp-4);
		font-size: 16px;
	}
	.tile-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--sp-2);
	}
	.tile {
		padding: var(--sp-3);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		text-align: center;
		color: var(--sage-700);
	}
	.tile span {
		font-size: 11.5px;
		font-weight: 600;
		color: var(--ink);
	}
	.free-text {
		margin-top: var(--sp-2);
		color: var(--ink-2);
	}
	.warn-panel {
		background: var(--warn-bg);
		border: 1.5px solid var(--warn-border);
		border-radius: var(--r-inner);
		padding: var(--sp-3) var(--sp-4);
	}
	.warn-row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-1) 0;
		color: var(--warn-text);
	}
	.supply-card,
	.schedule-card {
		padding: var(--sp-4);
	}
	.supply-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.meter-track {
		height: 10px;
		background: var(--surface-sunk);
		border-radius: 999px;
		overflow: hidden;
		margin-top: var(--sp-3);
	}
	.meter-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--sage-700);
	}
	.meter-fill.meter-low {
		background: var(--warn-border);
	}
	.course-note {
		margin-top: var(--sp-2);
		color: var(--ink-2);
	}
	.dose-line {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--sage-700);
		margin-bottom: var(--sp-1);
	}
	.actions {
		display: flex;
		gap: var(--sp-3);
		margin-top: var(--sp-8);
	}
	.actions .btn {
		flex: 1;
	}
</style>

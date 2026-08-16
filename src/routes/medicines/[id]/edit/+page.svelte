<script lang="ts">
	import { onMount } from 'svelte';
	import MedicineForm, { type MedicineFormInitialData } from '$lib/components/MedicineForm.svelte';
	import { apiFetch } from '$lib/client/api';
	import type { InstructionTag, WarningTag } from '$lib/shared/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface DetailResponse {
		medicine: {
			name: string;
			strength: string | null;
			form: string;
			what_for: string | null;
			instructions_text: string | null;
			instruction_tags: string;
			warning_tags: string;
			notes: string | null;
			supply_count: number | null;
		};
		schedule: {
			dose_amount: number;
			dose_unit: string;
			repeat_type: 'daily' | 'every_n_days' | 'weekdays';
			repeat_interval_days: number | null;
			weekdays_mask: number | null;
			start_date: string;
			end_date: string | null;
			times: Array<{ time_local: string; anchor_label: string | null }>;
		} | null;
	}

	let loading = $state(true);
	let initial = $state<MedicineFormInitialData | undefined>(undefined);

	async function load() {
		const res = await apiFetch<DetailResponse>(`/api/medicines/${data.id}`);
		initial = {
			name: res.medicine.name,
			strength: res.medicine.strength ?? '',
			form: res.medicine.form,
			whatFor: res.medicine.what_for ?? '',
			instructionsText: res.medicine.instructions_text ?? '',
			instructionTags: JSON.parse(res.medicine.instruction_tags) as InstructionTag[],
			warningTags: JSON.parse(res.medicine.warning_tags) as WarningTag[],
			notes: res.medicine.notes ?? '',
			supplyCount: res.medicine.supply_count,
			schedule: res.schedule
				? {
						doseAmount: res.schedule.dose_amount,
						doseUnit: res.schedule.dose_unit,
						repeatType: res.schedule.repeat_type,
						repeatIntervalDays: res.schedule.repeat_interval_days,
						weekdaysMask: res.schedule.weekdays_mask,
						startDate: res.schedule.start_date,
						endDate: res.schedule.end_date,
						times: res.schedule.times.map((t) => ({
							timeLocal: t.time_local,
							anchorLabel: t.anchor_label
						}))
					}
				: null
		};
		loading = false;
	}
	onMount(load);
</script>

<svelte:head>
	<title>Edit medicine · MedsAssist</title>
</svelte:head>

<h1 class="t-title heading">Edit medicine</h1>
{#if loading}
	<p class="t-body loading">Loading…</p>
{:else}
	<MedicineForm mode="edit" medicineId={data.id} {initial} />
{/if}

<style>
	.heading {
		max-width: 460px;
		margin: var(--sp-5) auto 0;
		padding: 0 var(--sp-4);
	}
	.loading {
		text-align: center;
		color: var(--ink-2);
		padding: var(--sp-10) 0;
	}
</style>

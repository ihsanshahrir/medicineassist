<!--
  OCR wizard (M3), Step 2 — Confirm. Mirrors
  design/preview/screens-add-ocr-confirm.html. Nothing here is written back
  to the medicine until "Continue" — see OcrConfirmRow for the per-field
  unverified/accepted/low-conf state that IS the safety property.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import OcrConfirmRow from '$lib/components/OcrConfirmRow.svelte';
	import WizardProgress from '$lib/components/WizardProgress.svelte';
	import Pictogram from '$lib/components/Pictogram.svelte';
	import { apiFetch } from '$lib/client/api';
	import { resolve } from '$app/paths';
	import { INSTRUCTION_TAG_META, WARNING_TAG_META, tagLabel } from '$lib/shared/instructionTags';
	import { userSettings } from '$lib/stores/userSettings.svelte';
	import type { InstructionTag, WarningTag } from '$lib/shared/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface ExtractedField<T> {
		value: T;
		confidence: number;
	}
	interface OcrResult {
		extracted: {
			name?: ExtractedField<string>;
			strength?: ExtractedField<string>;
			form?: ExtractedField<string>;
			doseAmount?: ExtractedField<number>;
			doseUnit?: ExtractedField<string>;
			frequencyPerDay?: ExtractedField<number>;
			instructionsText?: ExtractedField<string>;
		};
		instructionTagsSuggested: InstructionTag[];
		warningTagsSuggested: WarningTag[];
		lowConfidenceFields: string[];
		ocrFailed: boolean;
	}

	let loading = $state(true);
	let loadError = $state('');
	let labelPhotoKey = $state<string | null>(null);
	let lowConf = $state<Set<string>>(new Set());

	let name = $state('');
	let strength = $state('');
	let form = $state('');
	let doseAmount = $state('');
	let doseUnit = $state('');
	let frequencyPerDay = $state('');
	let instructionsText = $state('');
	let instructionTags = $state(new Set<string>());
	let warningTags = $state(new Set<string>());

	function toggleTag(set: Set<string>, tag: string) {
		if (set.has(tag)) set.delete(tag);
		else set.add(tag);
	}

	async function load() {
		try {
			const detail = await apiFetch<{ medicine: { label_photo_key: string | null } }>(
				`/api/medicines/${data.id}`
			);
			labelPhotoKey = detail.medicine.label_photo_key;

			const result = await apiFetch<OcrResult>(`/api/medicines/${data.id}/ocr`, {
				method: 'POST'
			});
			if (result.ocrFailed) {
				window.location.href = `/medicines/add/manual?id=${data.id}`;
				return;
			}

			const e = result.extracted;
			name = e.name?.value ?? '';
			strength = e.strength?.value ?? '';
			form = e.form?.value ?? '';
			doseAmount = e.doseAmount?.value != null ? String(e.doseAmount.value) : '';
			doseUnit = e.doseUnit?.value ?? '';
			frequencyPerDay = e.frequencyPerDay?.value != null ? String(e.frequencyPerDay.value) : '';
			instructionsText = e.instructionsText?.value ?? '';
			lowConf = new Set(result.lowConfidenceFields);
			instructionTags = new Set(result.instructionTagsSuggested);
			warningTags = new Set(result.warningTagsSuggested);
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that label.';
		} finally {
			loading = false;
		}
	}
	onMount(load);

	let saving = $state(false);
	let error = $state('');

	async function submit() {
		if (!name.trim()) {
			error = 'Enter a medicine name to continue.';
			return;
		}
		error = '';
		saving = true;
		try {
			await apiFetch(`/api/medicines/${data.id}`, {
				method: 'PATCH',
				body: JSON.stringify({
					name: name.trim(),
					strength: strength || null,
					form: form || undefined,
					instructionsText: instructionsText || null,
					instructionTags: [...instructionTags],
					warningTags: [...warningTags]
				})
			});
			const qs = new SvelteURLSearchParams({ id: data.id });
			if (doseAmount) qs.set('doseAmount', doseAmount);
			if (doseUnit) qs.set('doseUnit', doseUnit);
			if (frequencyPerDay) qs.set('freq', frequencyPerDay);
			window.location.href = `${resolve('/medicines/add/pill-photo')}?${qs.toString()}`;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Confirm details · MedsAssist</title>
</svelte:head>

<main>
	<WizardProgress step={2} />
	<h1 class="t-title">Confirm the details</h1>
	<p class="t-body intro">Tap or edit each field to confirm it's correct</p>

	{#if loading}
		<p class="t-body loading">Reading the label…</p>
	{:else if loadError}
		<p class="error t-caption">{loadError}</p>
	{:else}
		{#if labelPhotoKey}
			<img class="label-thumb" src="/api/photos/{labelPhotoKey}" alt="Photographed label" />
		{/if}

		<OcrConfirmRow label="Medicine name" bind:value={name} lowConfidence={lowConf.has('name')} />
		<OcrConfirmRow label="Strength" bind:value={strength} lowConfidence={lowConf.has('strength')} />
		<OcrConfirmRow label="Form" bind:value={form} lowConfidence={lowConf.has('form')} />
		<OcrConfirmRow
			label="Dose per intake"
			bind:value={doseAmount}
			lowConfidence={lowConf.has('doseAmount')}
		/>
		<OcrConfirmRow
			label="Dose unit"
			bind:value={doseUnit}
			lowConfidence={lowConf.has('doseUnit')}
		/>
		<OcrConfirmRow
			label="Times per day"
			bind:value={frequencyPerDay}
			lowConfidence={lowConf.has('frequencyPerDay')}
		/>
		<OcrConfirmRow
			label="Instructions"
			bind:value={instructionsText}
			lowConfidence={lowConf.has('instructionsText')}
			multiline
		/>

		<h2 class="t-h2 section-title">How to take it</h2>
		<div class="tag-grid">
			{#each Object.entries(INSTRUCTION_TAG_META) as [tag, meta] (tag)}
				<button
					type="button"
					class="tag-chip"
					class:active={instructionTags.has(tag)}
					onclick={() => toggleTag(instructionTags, tag)}
				>
					<Pictogram id={meta.picId} size={22} />
					<span>{tagLabel(meta, userSettings.language)}</span>
				</button>
			{/each}
		</div>

		<h2 class="t-h2 section-title">Warnings</h2>
		<div class="tag-grid">
			{#each Object.entries(WARNING_TAG_META) as [tag, meta] (tag)}
				<button
					type="button"
					class="tag-chip warn"
					class:active={warningTags.has(tag)}
					onclick={() => toggleTag(warningTags, tag)}
				>
					<Pictogram id={meta.picId} size={22} />
					<span>{tagLabel(meta, userSettings.language)}</span>
				</button>
			{/each}
		</div>

		{#if error}<p class="error t-caption">{error}</p>{/if}
		<button class="btn btn-primary" disabled={saving} onclick={submit}>
			{saving ? 'Saving…' : 'Continue'}
		</button>
	{/if}
</main>

<style>
	main {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
	}
	.intro {
		color: var(--ink-2);
		margin: var(--sp-2) 0 var(--sp-4);
	}
	.loading {
		text-align: center;
		color: var(--ink-2);
		padding: var(--sp-10) 0;
	}
	.label-thumb {
		width: 100%;
		max-height: 180px;
		object-fit: cover;
		border-radius: var(--r-card);
		margin-bottom: var(--sp-2);
	}
	.section-title {
		margin-top: var(--sp-6);
		margin-bottom: var(--sp-2);
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
	.error {
		color: var(--danger-text);
		margin-top: var(--sp-3);
	}
	.btn {
		width: 100%;
		margin-top: var(--sp-5);
	}
</style>

<!--
  OCR wizard (M3), Step 3 — Pill photo. Per docs/PRD.md F2: "the highest-value
  asset in the whole product" — a photo of the actual tablet, separate and
  deliberate from the label photo. Skippable; the shape/colour glyph-picker
  PRD describes as the skip fallback needs schema columns that don't exist
  yet (medicines has no shape/colour fields), so skip here just moves on —
  the medicine still falls back to its form glyph everywhere else already.
-->
<script lang="ts">
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import WizardProgress from '$lib/components/WizardProgress.svelte';
	import { uploadPhoto } from '$lib/client/api';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let busy = $state(false);
	let error = $state('');
	let cameraInput: HTMLInputElement;

	function nextUrl(): string {
		const qs = new SvelteURLSearchParams({ id: data.id });
		if (data.doseAmount) qs.set('doseAmount', data.doseAmount);
		if (data.doseUnit) qs.set('doseUnit', data.doseUnit);
		if (data.freq) qs.set('freq', data.freq);
		return `${resolve('/medicines/add/schedule')}?${qs.toString()}`;
	}

	async function handleFile(file: File | undefined) {
		if (!file) return;
		busy = true;
		error = '';
		try {
			await uploadPhoto(`/api/medicines/${data.id}/pill-photo`, file);
			window.location.href = nextUrl();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not upload that photo. Please try again.';
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Photo of the pill · MedsAssist</title>
</svelte:head>

<main>
	<WizardProgress step={3} />
	<h1 class="t-title">Photograph the pill</h1>
	<p class="t-body intro">
		A photo of the actual tablet or capsule, ideally on a plain surface — this is what stops mixing
		up two white round tablets.
	</p>

	<div class="frame">💊</div>

	<input
		bind:this={cameraInput}
		class="hidden-input"
		type="file"
		accept="image/*"
		capture="environment"
		onchange={(e) => handleFile(e.currentTarget.files?.[0])}
	/>

	<button class="btn btn-primary" disabled={busy} onclick={() => cameraInput.click()}>
		{busy ? 'Uploading…' : 'Take a photo'}
	</button>

	{#if error}<p class="error t-caption">{error}</p>{/if}

	<button type="button" class="btn-text skip" onclick={() => (window.location.href = nextUrl())}>
		Skip for now
	</button>
</main>

<style>
	main {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
	}
	.intro {
		color: var(--ink-2);
		margin: var(--sp-2) 0 var(--sp-5);
	}
	.frame {
		width: 100%;
		height: 220px;
		border-radius: var(--r-card);
		background: var(--surface-sunk);
		border: 1.5px dashed var(--line-strong);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 48px;
		margin-bottom: var(--sp-5);
	}
	.hidden-input {
		display: none;
	}
	.btn {
		width: 100%;
	}
	.error {
		color: var(--danger-text);
		margin-top: var(--sp-3);
	}
	.skip {
		display: block;
		text-align: center;
		margin-top: var(--sp-5);
	}
</style>

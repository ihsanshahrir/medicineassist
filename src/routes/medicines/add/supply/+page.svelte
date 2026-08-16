<!--
  OCR wizard (M3), Step 5 — Supply, the last step. Optional, per docs/PRD.md
  F2 — either path below calls POST .../finish, the one place is_draft flips
  1->0 (see finalizeMedicineDraft), so a skip still finishes the medicine.
-->
<script lang="ts">
	import WizardProgress from '$lib/components/WizardProgress.svelte';
	import { apiFetch } from '$lib/client/api';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let count = $state<number | null>(null);
	let saving = $state(false);
	let error = $state('');

	async function finish() {
		error = '';
		saving = true;
		try {
			if (count !== null) {
				await apiFetch(`/api/medicines/${data.id}/supply`, {
					method: 'PATCH',
					body: JSON.stringify({ count })
				});
			}
			await apiFetch(`/api/medicines/${data.id}/finish`, { method: 'POST' });
			window.location.href = `/medicines/${data.id}`;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>How many do you have? · MedsAssist</title>
</svelte:head>

<main>
	<WizardProgress step={5} />
	<h1 class="t-title">How many do you have?</h1>
	<p class="t-body intro">Optional — lets MedsAssist warn you before you run out.</p>

	<div class="stepper">
		<button
			type="button"
			aria-label="Decrease count"
			onclick={() => (count = Math.max(0, (count ?? 0) - 1))}>–</button
		>
		<span class="t-display val">{count ?? '—'}</span>
		<button type="button" aria-label="Increase count" onclick={() => (count = (count ?? 0) + 1)}
			>+</button
		>
	</div>

	{#if error}<p class="error t-caption">{error}</p>{/if}
	<button class="btn btn-primary" disabled={saving} onclick={finish}>
		{saving ? 'Saving…' : 'Done'}
	</button>
	<button class="btn-text skip" disabled={saving} onclick={finish}>Skip for now</button>
</main>

<style>
	main {
		max-width: 400px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
	}
	.intro {
		color: var(--ink-2);
		margin: var(--sp-2) 0 var(--sp-8);
	}
	.stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-6);
		margin-bottom: var(--sp-8);
	}
	.stepper button {
		width: 56px;
		height: 56px;
		border-radius: var(--r-input);
		border: 1.5px solid var(--line-strong);
		background: var(--surface);
		font-size: 24px;
		font-weight: 700;
		color: var(--sage-700);
		cursor: pointer;
	}
	.val {
		min-width: 80px;
		text-align: center;
	}
	.error {
		color: var(--danger-text);
		text-align: center;
		margin-bottom: var(--sp-3);
	}
	.btn {
		width: 100%;
	}
	.skip {
		display: block;
		text-align: center;
		margin-top: var(--sp-3);
		width: 100%;
	}
</style>

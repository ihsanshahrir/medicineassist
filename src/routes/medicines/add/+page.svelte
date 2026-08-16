<!--
  OCR wizard (M3), Step 1 — Capture. Per docs/PRD.md F2: camera-first with
  "Type it in instead" / "Choose from gallery" always visible as escapes.
  Creates the draft medicine row (is_draft=1) right here, since
  POST .../label-photo needs an id to attach the upload to — the row gets
  finalized (is_draft=0) at the end of the wizard, in the Supply step.
-->
<script lang="ts">
	import WizardProgress from '$lib/components/WizardProgress.svelte';
	import { apiFetch, uploadPhoto } from '$lib/client/api';
	import { resolve } from '$app/paths';

	let busy = $state(false);
	let error = $state('');
	let cameraInput: HTMLInputElement;
	let galleryInput: HTMLInputElement;

	async function handleFile(file: File | undefined) {
		if (!file) return;
		busy = true;
		error = '';
		try {
			const { medicine } = await apiFetch<{ medicine: { id: string } }>('/api/medicines', {
				method: 'POST',
				body: JSON.stringify({ name: 'New medicine', isDraft: true })
			});
			await uploadPhoto(`/api/medicines/${medicine.id}/label-photo`, file);
			window.location.href = `/medicines/add/confirm?id=${medicine.id}`;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not upload that photo. Please try again.';
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Add medicine · MedsAssist</title>
</svelte:head>

<main>
	<WizardProgress step={1} />
	<h1 class="t-title">Photograph the label</h1>
	<p class="t-body intro">The pharmacy dispensing label or the retail box — either works.</p>

	<div class="frame">📷</div>

	<input
		bind:this={cameraInput}
		class="hidden-input"
		type="file"
		accept="image/*"
		capture="environment"
		onchange={(e) => handleFile(e.currentTarget.files?.[0])}
	/>
	<input
		bind:this={galleryInput}
		class="hidden-input"
		type="file"
		accept="image/*"
		onchange={(e) => handleFile(e.currentTarget.files?.[0])}
	/>

	<button class="btn btn-primary" disabled={busy} onclick={() => cameraInput.click()}>
		{busy ? 'Uploading…' : 'Take a photo'}
	</button>
	<button class="btn btn-secondary" disabled={busy} onclick={() => galleryInput.click()}>
		Choose from gallery
	</button>

	{#if error}<p class="error t-caption">{error}</p>{/if}

	<a class="btn-text type-instead" href={resolve('/medicines/add/manual')}>Type it in instead</a>
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
		margin-top: var(--sp-3);
	}
	.error {
		color: var(--danger-text);
		margin-top: var(--sp-3);
	}
	.type-instead {
		display: block;
		text-align: center;
		margin-top: var(--sp-5);
	}
</style>

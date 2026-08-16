<script lang="ts">
	import { apiFetch } from '$lib/client/api';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let amount = $state(30);
	let saving = $state(false);
	let error = $state('');

	async function submit(e: Event) {
		e.preventDefault();
		saving = true;
		error = '';
		try {
			await apiFetch(`/api/medicines/${data.id}/refill`, {
				method: 'POST',
				body: JSON.stringify({ amount })
			});
			window.location.href = `/medicines/${data.id}`;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong.';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Refill · MedsAssist</title>
</svelte:head>

<main>
	<h1 class="t-title">I got a refill</h1>
	<p class="t-body intro">How many did you add?</p>

	<form onsubmit={submit}>
		<div class="stepper">
			<button type="button" onclick={() => (amount = Math.max(1, amount - 5))}>–</button>
			<span class="t-display val">{amount}</span>
			<button type="button" onclick={() => (amount += 5)}>+</button>
		</div>

		{#if error}<p class="error t-caption">{error}</p>{/if}
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Add to supply'}
		</button>
	</form>
</main>

<style>
	main {
		max-width: 400px;
		margin: 0 auto;
		padding: var(--sp-8) var(--sp-4);
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
</style>

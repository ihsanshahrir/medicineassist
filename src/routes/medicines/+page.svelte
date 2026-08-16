<script lang="ts">
	import { onMount } from 'svelte';
	import Pictogram from '$lib/components/Pictogram.svelte';
	import { apiFetch } from '$lib/client/api';
	import { resolve } from '$app/paths';
	import { MEDICINE_FORM_GLYPH } from '$lib/shared/instructionTags';

	interface MedicineRow {
		id: string;
		name: string;
		strength: string | null;
		form: string;
		accent_index: number;
		supply_count: number | null;
	}

	let loading = $state(true);
	let medicines = $state<MedicineRow[]>([]);

	async function load() {
		loading = true;
		const res = await apiFetch<{ medicines: MedicineRow[] }>('/api/medicines');
		medicines = res.medicines;
		loading = false;
	}
	onMount(load);
</script>

<svelte:head>
	<title>My Medicines · MedsAssist</title>
</svelte:head>

<main>
	<div class="header">
		<h1 class="t-title">My Medicines</h1>
		<nav class="header-links" aria-label="Main">
			<a class="btn-text" href={resolve('/today')}>Today</a>
			<a class="btn-text" href={resolve('/medicines/add')}>+ Add</a>
		</nav>
	</div>

	{#if loading}
		<p class="t-body loading">Loading…</p>
	{:else if medicines.length === 0}
		<div class="empty">
			<p class="t-body-lg">No medicines yet.</p>
			<a class="btn btn-primary" href={resolve('/medicines/add')}>Add your first medicine</a>
		</div>
	{:else}
		{#each medicines as m (m.id)}
			<a class="row" href={resolve('/medicines/[id]', { id: m.id })}>
				<div class="photo" style:background="var(--accent-{m.accent_index})">
					<Pictogram id={MEDICINE_FORM_GLYPH[m.form] ?? 'glyph-tablet'} size={24} />
				</div>
				<div class="info">
					<b>{m.name}{m.strength ? ` ${m.strength}` : ''}</b>
					{#if m.supply_count !== null}
						<span class="t-caption">{m.supply_count} left</span>
					{/if}
				</div>
			</a>
		{/each}
	{/if}
</main>

<style>
	main {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
	}
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--sp-4);
	}
	.header-links {
		display: flex;
		gap: var(--sp-2);
	}
	.loading {
		text-align: center;
		color: var(--ink-2);
		padding: var(--sp-10) 0;
	}
	.empty {
		text-align: center;
		padding: var(--sp-16) var(--sp-4);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-4);
	}
	.empty p {
		color: var(--ink-2);
	}
	.empty .btn-primary {
		width: auto;
		display: inline-flex;
		text-decoration: none;
		padding: 0 var(--sp-6);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		background: var(--surface);
		border-radius: var(--r-inner);
		box-shadow: var(--shadow-1);
		padding: var(--sp-3) var(--sp-4);
		margin-bottom: var(--sp-2);
		text-decoration: none;
		color: var(--ink);
		min-height: var(--tap-min);
	}
	.photo {
		width: 46px;
		height: 46px;
		border-radius: 11px;
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sage-800);
	}
	.info b {
		display: block;
		font-size: 16px;
	}
	.info span {
		color: var(--ink-2);
	}
</style>

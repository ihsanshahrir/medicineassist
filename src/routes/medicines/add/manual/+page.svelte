<script lang="ts">
	import MedicineForm from '$lib/components/MedicineForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Add medicine · MedsAssist</title>
</svelte:head>

<h1 class="t-title heading">Add a medicine</h1>
{#if data.draftId}
	<p class="t-caption note">
		We couldn't read the label clearly enough — the photo's still attached. Fill in what you can.
	</p>
{/if}
<MedicineForm mode={data.draftId ? 'draft' : 'add'} medicineId={data.draftId ?? undefined} />

<style>
	.heading {
		max-width: 460px;
		margin: var(--sp-5) auto 0;
		padding: 0 var(--sp-4);
	}
	.note {
		max-width: 460px;
		margin: var(--sp-2) auto 0;
		padding: 0 var(--sp-4);
		color: var(--ink-2);
	}
</style>

<script lang="ts">
	import MedicineForm from '$lib/components/MedicineForm.svelte';
</script>

<svelte:head>
	<title>Add medicine · MedsAssist</title>
</svelte:head>

<h1 class="t-title heading">Add a medicine</h1>
<MedicineForm mode="add" />

<style>
	.heading {
		max-width: 460px;
		margin: var(--sp-5) auto 0;
		padding: 0 var(--sp-4);
	}
</style>

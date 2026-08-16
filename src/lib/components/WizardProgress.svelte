<!-- Matches the 5-dot progress bar in design/preview/screens-add-*.html. -->
<script lang="ts">
	interface Props {
		/** 1-indexed current step out of `total`. */
		step: number;
		total?: number;
	}
	let { step, total = 5 }: Props = $props();
</script>

<div
	class="progress"
	role="progressbar"
	aria-valuenow={step}
	aria-valuemin={1}
	aria-valuemax={total}
>
	{#each Array(total) as _, i (i)}
		<span class:done={i < step}></span>
	{/each}
</div>

<style>
	.progress {
		display: flex;
		gap: 4px;
		margin-bottom: var(--sp-4);
	}
	.progress span {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--line);
	}
	.progress span.done {
		background: var(--sage-700);
	}
</style>

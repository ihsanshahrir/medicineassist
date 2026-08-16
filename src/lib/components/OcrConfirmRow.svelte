<!--
  The safety-critical control from the plan's "OCR flow" section: every
  extracted field starts unverified (or low-conf below the 0.6 threshold) and
  only becomes accepted client-side, via an explicit tap or edit — never
  silently. Mirrors design/preview/components-ocr-confirm-row.html 1:1
  (field/field-body/field-label/field-val/field-tag class names).
-->
<script lang="ts">
	interface Props {
		label: string;
		value: string;
		lowConfidence?: boolean;
		multiline?: boolean;
	}
	let { label, value = $bindable(), lowConfidence = false, multiline = false }: Props = $props();

	let accepted = $state(false);

	function rowState(): 'accepted' | 'low-conf' | 'unverified' {
		if (accepted) return 'accepted';
		return lowConfidence ? 'low-conf' : 'unverified';
	}
</script>

<div
	class="field"
	class:accepted={rowState() === 'accepted'}
	class:low-conf={rowState() === 'low-conf'}
	class:unverified={rowState() === 'unverified'}
>
	<div class="field-body">
		<span class="field-label"
			>{label}{lowConfidence && !accepted ? ' — low confidence read' : ''}</span
		>
		{#if multiline}
			<textarea class="field-val" rows="2" bind:value oninput={() => (accepted = true)}></textarea>
		{:else}
			<input class="field-val" type="text" bind:value oninput={() => (accepted = true)} />
		{/if}
	</div>
	<button
		type="button"
		class="field-tag"
		class:tag-accepted={rowState() === 'accepted'}
		class:tag-low={rowState() === 'low-conf'}
		class:tag-unverified={rowState() === 'unverified'}
		onclick={() => (accepted = true)}
	>
		{rowState() === 'accepted'
			? '✓ Confirmed'
			: rowState() === 'low-conf'
				? 'Check this'
				: 'Confirm'}
	</button>
</div>

<style>
	.field {
		border-radius: var(--r-input);
		padding: var(--sp-3) var(--sp-4);
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin-top: var(--sp-3);
	}
	.field.unverified {
		background: var(--warn-bg);
		border: 1.5px dashed var(--warn-border);
	}
	.field.accepted {
		background: var(--state-done-bg);
		border: 1.5px solid transparent;
	}
	.field.low-conf {
		background: var(--danger-bg);
		border: 1.5px solid #e3a79e;
	}
	.field-body {
		flex: 1;
		min-width: 0;
	}
	.field-label {
		display: block;
		font-size: 10.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--ink-2);
	}
	.field-val {
		display: block;
		width: 100%;
		margin-top: 2px;
		border: none;
		background: transparent;
		padding: 0;
		font-size: 15.5px;
		font-family: var(--font-sans);
		color: var(--ink);
		resize: none;
	}
	.field-val:focus {
		outline: none;
	}
	.field-tag {
		flex: 0 0 auto;
		font-size: 10.5px;
		font-weight: 700;
		padding: 5px 10px;
		border-radius: 999px;
		white-space: nowrap;
		border: none;
		cursor: pointer;
		min-height: 32px;
	}
	.tag-unverified {
		background: var(--warn-border);
		color: #fff;
	}
	.tag-accepted {
		background: var(--state-done);
		color: #fff;
	}
	.tag-low {
		background: var(--danger-text);
		color: #fff;
	}
</style>

<!--
  One screen, passwordless, per docs/PRD.md §F1: email → 6-digit code, no
  password to create or reset. Two steps live on this one route rather than
  separate pages, matching the PRD's "one screen" framing.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let step = $state<'email' | 'code'>('email');
	let email = $state('');
	let code = $state('');
	let busy = $state(false);
	let error = $state('');

	const ERROR_TEXT: Record<string, string> = {
		invalid_email: "That doesn't look like a valid email address.",
		rate_limited: 'Too many codes requested. Please wait a while and try again.',
		invalid: "That code isn't right. Check and try again.",
		expired: 'That code has expired. Request a new one.',
		too_many_attempts: 'Too many attempts. Request a new code.',
		invalid_request: 'Something went wrong. Please try again.'
	};

	async function requestCode(e: Event) {
		e.preventDefault();
		error = '';
		busy = true;
		try {
			const res = await fetch('/api/auth/otp/request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const data = (await res.json()) as { error?: string };
			if (!res.ok) {
				error = (data.error && ERROR_TEXT[data.error]) || 'Something went wrong. Please try again.';
				return;
			}
			step = 'code';
		} finally {
			busy = false;
		}
	}

	async function verifyCode(e: Event) {
		e.preventDefault();
		error = '';
		busy = true;
		try {
			const res = await fetch('/api/auth/otp/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code })
			});
			const data = (await res.json()) as { error?: string };
			if (!res.ok) {
				error = (data.error && ERROR_TEXT[data.error]) || 'Something went wrong. Please try again.';
				return;
			}
			await goto(resolve('/today'));
		} finally {
			busy = false;
		}
	}

	function backToEmail() {
		step = 'email';
		code = '';
		error = '';
	}
</script>

<svelte:head>
	<title>Sign in · MedsAssist</title>
</svelte:head>

<main>
	<div class="card">
		<h1 class="t-title">MedsAssist</h1>

		{#if step === 'email'}
			<p class="t-body intro">
				Enter your email and we'll send you a 6-digit code — no password needed.
			</p>
			<form onsubmit={requestCode}>
				<label class="t-label" for="email">Email</label>
				<input
					id="email"
					class="text-input"
					type="email"
					inputmode="email"
					autocomplete="email"
					required
					bind:value={email}
					disabled={busy}
				/>
				{#if error}<p class="error t-caption">{error}</p>{/if}
				<button class="btn btn-primary" type="submit" disabled={busy || !email}>
					{busy ? 'Sending…' : 'Send code'}
				</button>
			</form>
		{:else}
			<p class="t-body intro">
				Enter the 6-digit code we sent to <b>{email}</b>.
			</p>
			<form onsubmit={verifyCode}>
				<label class="t-label" for="code">Code</label>
				<input
					id="code"
					class="text-input code-input"
					type="text"
					inputmode="numeric"
					pattern="[0-9]*"
					autocomplete="one-time-code"
					maxlength="6"
					required
					bind:value={code}
					disabled={busy}
				/>
				{#if error}<p class="error t-caption">{error}</p>{/if}
				<button class="btn btn-primary" type="submit" disabled={busy || code.length !== 6}>
					{busy ? 'Checking…' : 'Continue'}
				</button>
				<button class="btn-text back-btn" type="button" onclick={backToEmail} disabled={busy}>
					Use a different email
				</button>
			</form>
		{/if}
	</div>
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--sp-5);
	}
	.card {
		width: 100%;
		max-width: 400px;
		background: var(--surface);
		border-radius: var(--r-card);
		box-shadow: var(--shadow-2);
		padding: var(--sp-8) var(--sp-6);
	}
	.intro {
		color: var(--ink-2);
		margin: var(--sp-3) 0 var(--sp-6);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	label {
		margin-bottom: 2px;
	}
	.text-input {
		width: 100%;
		min-height: var(--tap-min);
		border-radius: var(--r-input);
		border: 1.5px solid var(--line-strong);
		background: var(--surface);
		padding: 0 var(--sp-4);
		font-size: var(--t-body-size);
		color: var(--ink);
		margin-bottom: var(--sp-4);
	}
	.text-input:focus-visible {
		border-color: var(--sage-700);
	}
	.code-input {
		font-size: 28px;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.3em;
		text-align: center;
	}
	.error {
		color: var(--danger-text);
		margin: calc(var(--sp-4) * -1) 0 var(--sp-3);
	}
	.back-btn {
		align-self: center;
	}
</style>

<!--
  M6 — Settings. Mirrors design/preview/screens-settings.html: Reminders
  health row, Language, Text size, Quiet hours, Account (export/delete).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/client/api';
	import {
		disableReminders,
		enableReminders,
		getPushStatus,
		type PushStatus
	} from '$lib/client/push';
	import { formatTimeLabel } from '$lib/shared/formatTime';
	import { userSettings } from '$lib/stores/userSettings.svelte';

	interface MeResponse {
		email: string;
		language: 'en' | 'ms';
		textSize: 'normal' | 'large' | 'xl';
		quietHours: { startLocal: string; endLocal: string } | null;
		reminderHealth: {
			hasSubscription: boolean;
			installedAsPwa: boolean;
			lastDeliveredAt: string | null;
		};
	}

	let loading = $state(true);
	let me = $state<MeResponse | null>(null);
	let pushStatus = $state<PushStatus | 'checking'>('checking');
	let pushBusy = $state(false);
	let pushError = $state('');

	let quietEnabled = $state(false);
	let quietStart = $state('22:00');
	let quietEnd = $state('06:30');
	let quietSaving = $state(false);

	let deleting = $state(false);

	async function load() {
		me = await apiFetch<MeResponse>('/api/me');
		userSettings.language = me.language;
		userSettings.textSize = me.textSize;
		quietEnabled = me.quietHours !== null;
		quietStart = me.quietHours?.startLocal ?? '22:00';
		quietEnd = me.quietHours?.endLocal ?? '06:30';
		loading = false;
		pushStatus = await getPushStatus();
	}
	onMount(load);

	async function setLanguage(language: 'en' | 'ms') {
		userSettings.language = language;
		await apiFetch('/api/me', { method: 'PATCH', body: JSON.stringify({ language }) });
	}

	async function setTextSize(textSize: 'normal' | 'large' | 'xl') {
		userSettings.textSize = textSize;
		await apiFetch('/api/me', { method: 'PATCH', body: JSON.stringify({ textSize }) });
	}

	async function saveQuietHours() {
		quietSaving = true;
		try {
			await apiFetch('/api/me', {
				method: 'PATCH',
				body: JSON.stringify({
					quietHours: quietEnabled ? { startLocal: quietStart, endLocal: quietEnd } : null
				})
			});
		} finally {
			quietSaving = false;
		}
	}

	async function toggleReminders() {
		pushError = '';
		pushBusy = true;
		try {
			if (pushStatus === 'subscribed') {
				await disableReminders();
				pushStatus = 'unsubscribed';
			} else {
				await enableReminders();
				pushStatus = 'subscribed';
			}
			// installedAsPwa/hasSubscription on the server won't reflect this until
			// the next load, but the button state above is what actually matters
			// here — a stale health row for a few seconds isn't worth a re-fetch.
		} catch (err) {
			pushError = err instanceof Error ? err.message : 'Could not update reminders.';
		} finally {
			pushBusy = false;
		}
	}

	function exportData() {
		window.location.href = '/api/me/export';
	}

	async function deleteAccount() {
		if (!confirm("Delete your account and all your data? This can't be undone.")) return;
		deleting = true;
		try {
			await apiFetch('/api/me', { method: 'DELETE' });
			window.location.href = '/sign-in';
		} catch {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>Settings · MedsAssist</title>
</svelte:head>

<main>
	<h1 class="t-title heading">Settings</h1>

	{#if loading || !me}
		<p class="t-body loading">Loading…</p>
	{:else}
		<section class="section">
			<h3 class="t-caption label">Reminders</h3>
			{#if me.reminderHealth.hasSubscription}
				<div class="health-row" class:health-warn={!me.reminderHealth.installedAsPwa}>
					<div class="dot" class:dot-warn={!me.reminderHealth.installedAsPwa}></div>
					<div class="health-body">
						{#if !me.reminderHealth.installedAsPwa}
							<b>Reminders may not arrive reliably</b>
							<span>Add MedsAssist to your Home Screen — required for notifications on iOS.</span>
						{:else if me.reminderHealth.lastDeliveredAt}
							<b>Reminders are working</b>
							<span
								>Home Screen · Last delivered {formatTimeLabel(
									me.reminderHealth.lastDeliveredAt
								)}</span
							>
						{:else}
							<b>Reminders are set up</b>
							<span>Home Screen · None delivered yet</span>
						{/if}
					</div>
				</div>
			{/if}

			<button class="btn btn-secondary reminder-btn" onclick={toggleReminders} disabled={pushBusy}>
				{pushBusy
					? 'Working…'
					: pushStatus === 'subscribed'
						? 'Turn off reminders'
						: 'Turn on reminders'}
			</button>
			{#if pushError}<p class="error t-caption">{pushError}</p>{/if}
			{#if pushStatus === 'unsupported'}
				<p class="t-caption note">Push notifications aren't supported on this browser.</p>
			{:else if pushStatus === 'denied'}
				<p class="t-caption note">
					Blocked — enable notifications for this site in your browser settings.
				</p>
			{/if}
		</section>

		<section class="section">
			<h3 class="t-caption label">Language / Bahasa</h3>
			<div class="segmented">
				<button
					type="button"
					class:active={userSettings.language === 'en'}
					onclick={() => setLanguage('en')}
				>
					English
				</button>
				<button
					type="button"
					class:active={userSettings.language === 'ms'}
					onclick={() => setLanguage('ms')}
				>
					Bahasa Malaysia
				</button>
			</div>
			<p class="t-caption note">
				Applies to medicine instruction and warning labels. The rest of the app stays in English for
				now.
			</p>
		</section>

		<section class="section">
			<h3 class="t-caption label">Text size</h3>
			<div class="segmented">
				<button
					type="button"
					class:active={userSettings.textSize === 'normal'}
					onclick={() => setTextSize('normal')}
				>
					Normal
				</button>
				<button
					type="button"
					class:active={userSettings.textSize === 'large'}
					onclick={() => setTextSize('large')}
				>
					Large
				</button>
				<button
					type="button"
					class:active={userSettings.textSize === 'xl'}
					onclick={() => setTextSize('xl')}
				>
					Extra Large
				</button>
			</div>
		</section>

		<section class="section">
			<h3 class="t-caption label">Quiet hours</h3>
			<label class="row toggle-row">
				<span class="lbl">Do not notify between</span>
				<input
					type="checkbox"
					bind:checked={quietEnabled}
					onchange={saveQuietHours}
					aria-label="Enable quiet hours"
				/>
			</label>
			{#if quietEnabled}
				<div class="quiet-times">
					<input
						type="time"
						class="text-input"
						bind:value={quietStart}
						onchange={saveQuietHours}
						aria-label="Quiet hours start"
					/>
					<span class="t-body">to</span>
					<input
						type="time"
						class="text-input"
						bind:value={quietEnd}
						onchange={saveQuietHours}
						aria-label="Quiet hours end"
					/>
					{#if quietSaving}<span class="t-caption saving">Saving…</span>{/if}
				</div>
				<p class="t-caption note">
					Doses during this window still show up in the app, just without a push.
				</p>
			{/if}
		</section>

		<section class="section">
			<h3 class="t-caption label">Account</h3>
			<div class="row">
				<span class="lbl">Signed in</span>
				<span class="val">{me.email}</span>
			</div>
			<button type="button" class="row row-button" onclick={exportData}>
				<span class="lbl">Export my data</span>
			</button>
			<button
				type="button"
				class="row row-button row-danger"
				onclick={deleteAccount}
				disabled={deleting}
			>
				<span class="lbl">{deleting ? 'Deleting…' : 'Delete account'}</span>
			</button>
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
	}
	.heading {
		margin-bottom: var(--sp-2);
	}
	.loading {
		text-align: center;
		color: var(--ink-2);
		padding: var(--sp-10) 0;
	}
	.section {
		margin-top: var(--sp-6);
	}
	.label {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink-3);
		margin-bottom: var(--sp-2);
	}
	.health-row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-inner);
		background: var(--state-done-bg);
		margin-bottom: var(--sp-3);
	}
	.health-row.health-warn {
		background: var(--warn-bg);
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--state-done);
		flex: 0 0 auto;
	}
	.dot.dot-warn {
		background: var(--warn-border);
	}
	.health-body b {
		display: block;
		font-size: var(--t-body-size);
		line-height: var(--t-body-line);
	}
	.health-body span {
		font-size: var(--t-caption-size);
		color: var(--ink-2);
	}
	.reminder-btn {
		width: 100%;
	}
	.error {
		color: var(--danger-text);
		margin-top: var(--sp-2);
	}
	.note {
		color: var(--ink-2);
		margin-top: var(--sp-2);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		background: var(--surface);
		border-radius: var(--r-inner);
		padding: var(--sp-3) var(--sp-4);
		box-shadow: var(--shadow-1);
		margin-bottom: var(--sp-2);
		min-height: var(--tap-min);
		width: 100%;
		border: none;
		text-align: left;
		font-family: var(--font-sans);
		cursor: pointer;
	}
	.toggle-row {
		cursor: default;
	}
	.row .lbl {
		flex: 1;
		font-size: var(--t-body-size);
		color: var(--ink);
	}
	.row .val {
		font-size: var(--t-caption-size);
		color: var(--ink-2);
	}
	.row-button {
		cursor: pointer;
	}
	.row-danger .lbl {
		color: var(--danger-text);
	}
	.quiet-times {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin-top: var(--sp-2);
	}
	.text-input {
		width: auto;
		padding: 0 var(--sp-3);
	}
	.saving {
		color: var(--ink-2);
	}
</style>

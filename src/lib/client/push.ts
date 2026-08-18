// Browser-side half of the M4 reminder pipeline: subscribes this
// browser/device to Web Push and registers it with the server. Sending is
// entirely workers/reminder-engine's job (cron scan -> queue -> VAPID push);
// this file never talks to the push service directly.
import { isStandalone } from './platform';
import { apiFetch } from './api';

export type PushStatus = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed';

export function isPushSupported(): boolean {
	return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushStatus(): Promise<PushStatus> {
	if (!isPushSupported()) return 'unsupported';
	if (Notification.permission === 'denied') return 'denied';

	const reg = await navigator.serviceWorker.ready;
	const existing = await reg.pushManager.getSubscription();
	return existing ? 'subscribed' : 'unsubscribed';
}

// applicationServerKey wants a raw Uint8Array — the server hands back the
// VAPID public key as a base64url string (same encoding `wrangler secret
// put` and scripts/generate-vapid-keys.mjs use throughout).
function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
	const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
		.replace(/-/g, '+')
		.replace(/_/g, '/');
	const raw = atob(base64);
	return new Uint8Array(Array.from(raw, (c) => c.charCodeAt(0)));
}

export async function enableReminders(): Promise<void> {
	if (!isPushSupported()) throw new Error('Push notifications are not supported on this browser.');

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') throw new Error('Notification permission was not granted.');

	const { key } = await apiFetch<{ key: string }>('/api/push/public-key');
	const reg = await navigator.serviceWorker.ready;
	const subscription = await reg.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: base64UrlToUint8Array(key)
	});

	const json = subscription.toJSON();
	await apiFetch('/api/push/subscribe', {
		method: 'POST',
		body: JSON.stringify({
			endpoint: json.endpoint,
			keys: json.keys,
			// Evaluated at subscribe time, on purpose — this records how the app
			// was running when the subscription was created. Shares
			// platform.ts's check with the marketing page, which also fixes a
			// bug: the local copy this replaced omitted the fullscreen and
			// minimal-ui display modes, so an app launched that way reported
			// itself as not installed and Settings then warned a correctly
			// installed user that reminders might not arrive.
			installedAsPwa: isStandalone()
		})
	});
}

export async function disableReminders(): Promise<void> {
	if (!isPushSupported()) return;
	const reg = await navigator.serviceWorker.ready;
	const subscription = await reg.pushManager.getSubscription();
	if (!subscription) return;

	const endpoint = subscription.endpoint;
	await subscription.unsubscribe();
	await apiFetch('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
}

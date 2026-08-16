// @pushforge/builder, not Node's `web-push` package — the latter needs
// crypto.createECDH, which doesn't exist on the Workers runtime (see the
// plan's "Reminder pipeline" section). This is the only thing in the repo
// that actually sends a push; the root app only ever stores subscriptions.
import { buildPushHTTPRequest } from '@pushforge/builder';
import {
	deletePushSubscription,
	listPushSubscriptionsForUser,
	type PushSubscriptionRow
} from './db';

export interface PushPayload {
	title: string;
	body: string;
	tag: string;
	url: string;
	// Index signature so this structurally satisfies @pushforge/builder's
	// Jsonifiable payload constraint — every field here is already a string.
	[key: string]: string;
}

async function sendToSubscription(
	env: Env,
	sub: PushSubscriptionRow,
	payload: PushPayload
): Promise<boolean> {
	const { endpoint, body, headers } = await buildPushHTTPRequest({
		privateJWK: env.VAPID_PRIVATE_JWK,
		subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
		message: {
			payload,
			adminContact: env.VAPID_SUBJECT,
			options: { ttl: 24 * 60 * 60, urgency: 'high' }
		}
	});

	const res = await fetch(endpoint, { method: 'POST', headers, body });

	// 404/410 means the push service considers this subscription gone for
	// good (uninstalled, expired) — clean it up so future ticks stop trying.
	if (res.status === 404 || res.status === 410) {
		await deletePushSubscription(env.DB, sub.id);
		return false;
	}
	if (!res.ok) {
		console.error(`push send failed: ${res.status} ${await res.text().catch(() => '')}`);
		return false;
	}
	return true;
}

/** True if at least one of the user's devices actually accepted the push —
 *  what Settings' Reminder-health row means by "delivered" (see index.ts's
 *  markPushSent call, gated on this return value rather than assumed). */
export async function sendPushToUser(
	env: Env,
	userId: string,
	payload: PushPayload
): Promise<boolean> {
	const subscriptions = await listPushSubscriptionsForUser(env.DB, userId);
	const results = await Promise.all(
		subscriptions.map((sub) => sendToSubscription(env, sub, payload))
	);
	return results.some(Boolean);
}

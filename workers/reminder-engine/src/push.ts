// @pushforge/builder, not Node's `web-push` package — the latter needs
// crypto.createECDH, which doesn't exist on the Workers runtime (see the
// plan's "Reminder pipeline" section). This is the only thing in the repo
// that actually sends a push; the root app only ever stores subscriptions.
import { buildPushHTTPRequest } from '@pushforge/builder';
import {
	deletePushSubscription,
	incrementUsageCounter,
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

	await incrementUsageCounter(env.DB, 'push_attempts');

	// A network-level exception here (DNS, timeout, connection reset) must
	// not propagate: sendPushToUser's Promise.all would otherwise reject for
	// this user's *entire* batch of devices, and index.ts's queue() handler
	// would retry the whole message — re-sending to devices that already
	// succeeded. Isolating each subscription's outcome is what fixes that.
	let res: Response;
	try {
		res = await fetch(endpoint, { method: 'POST', headers, body });
	} catch (err) {
		console.error(`push send threw: ${err}`);
		await incrementUsageCounter(env.DB, 'push_failures');
		return false;
	}

	// 404/410 means the push service considers this subscription gone for
	// good (uninstalled, expired) — clean it up so future ticks stop trying.
	// Other 4xx (400/403) are more often our own bug (bad VAPID config,
	// malformed payload) than a dead subscription, so deliberately not
	// deleting on those — that would risk mass-orphaning valid subscriptions
	// over our own error.
	if (res.status === 404 || res.status === 410) {
		await deletePushSubscription(env.DB, sub.id);
		await incrementUsageCounter(env.DB, 'push_failures');
		return false;
	}
	if (!res.ok) {
		console.error(`push send failed: ${res.status} ${await res.text().catch(() => '')}`);
		await incrementUsageCounter(env.DB, 'push_failures');
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

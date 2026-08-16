import { json } from '@sveltejs/kit';
import {
	removePushSubscription,
	upsertPushSubscription
} from '$lib/server/db/queries/pushSubscriptions';
import type { RequestHandler } from './$types';

interface SubscribeBody {
	endpoint?: unknown;
	keys?: { p256dh?: unknown; auth?: unknown };
	installedAsPwa?: unknown;
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as SubscribeBody | null;
	if (
		typeof body?.endpoint !== 'string' ||
		typeof body.keys?.p256dh !== 'string' ||
		typeof body.keys?.auth !== 'string'
	) {
		return json({ error: 'invalid_subscription' }, { status: 400 });
	}

	await upsertPushSubscription(platform!.env.DB, locals.user.id, {
		endpoint: body.endpoint,
		p256dh: body.keys.p256dh,
		auth: body.keys.auth,
		userAgent: request.headers.get('user-agent'),
		installedAsPwa: body.installedAsPwa === true
	});

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
	if (typeof body?.endpoint !== 'string')
		return json({ error: 'invalid_request' }, { status: 400 });

	await removePushSubscription(platform!.env.DB, locals.user.id, body.endpoint);
	return json({ ok: true });
};

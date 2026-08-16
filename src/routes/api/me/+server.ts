import { json } from '@sveltejs/kit';
import { lastPushDeliveredAt } from '$lib/server/db/queries/doseLogs';
import {
	anyPushSubscriptionInstalledAsPwa,
	hasPushSubscription
} from '$lib/server/db/queries/pushSubscriptions';
import { deleteUser, getUserById, updateUserSettings } from '$lib/server/db/queries/users';
import { deleteAllUserPhotos } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	const user = await getUserById(db, locals.user.id);
	if (!user) return json({ error: 'not_found' }, { status: 404 });

	const [hasSubscription, installedAsPwa, lastDeliveredAt] = await Promise.all([
		hasPushSubscription(db, user.id),
		anyPushSubscriptionInstalledAsPwa(db, user.id),
		lastPushDeliveredAt(db, user.id)
	]);

	return json({
		email: user.email,
		language: user.language,
		textSize: user.text_size,
		quietHours:
			user.quiet_hours_start_local && user.quiet_hours_end_local
				? { startLocal: user.quiet_hours_start_local, endLocal: user.quiet_hours_end_local }
				: null,
		reminderHealth: { hasSubscription, installedAsPwa, lastDeliveredAt }
	});
};

interface UpdateMeBody {
	language?: unknown;
	textSize?: unknown;
	quietHours?: { startLocal?: unknown; endLocal?: unknown } | null;
}

export const PATCH: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as UpdateMeBody | null;
	if (!body) return json({ error: 'invalid_request' }, { status: 400 });

	if (body.language !== undefined && body.language !== 'en' && body.language !== 'ms') {
		return json({ error: 'invalid_language' }, { status: 400 });
	}
	if (
		body.textSize !== undefined &&
		body.textSize !== 'normal' &&
		body.textSize !== 'large' &&
		body.textSize !== 'xl'
	) {
		return json({ error: 'invalid_text_size' }, { status: 400 });
	}
	let quietHours: { startLocal: string; endLocal: string } | null | undefined;
	if (body.quietHours === null) {
		quietHours = null;
	} else if (body.quietHours) {
		if (
			typeof body.quietHours.startLocal !== 'string' ||
			typeof body.quietHours.endLocal !== 'string'
		) {
			return json({ error: 'invalid_quiet_hours' }, { status: 400 });
		}
		quietHours = { startLocal: body.quietHours.startLocal, endLocal: body.quietHours.endLocal };
	}

	const updated = await updateUserSettings(platform!.env.DB, locals.user.id, {
		language: body.language as 'en' | 'ms' | undefined,
		textSize: body.textSize as 'normal' | 'large' | 'xl' | undefined,
		quietHours
	});
	if (!updated) return json({ error: 'not_found' }, { status: 404 });
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, platform, cookies }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	// KV values aren't covered by D1's ON DELETE CASCADE, so this has to be
	// done explicitly, and before the D1 row (which holds the keys) is gone.
	await deleteAllUserPhotos(platform!.env.PHOTOS, locals.user.id);
	await deleteUser(platform!.env.DB, locals.user.id);
	cookies.delete('session', { path: '/' });
	return json({ ok: true });
};

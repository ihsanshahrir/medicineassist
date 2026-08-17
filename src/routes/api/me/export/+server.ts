import { json } from '@sveltejs/kit';
import { staleSession } from '$lib/server/auth/guard';
import { listAllDoseLogsForExport } from '$lib/server/db/queries/doseLogs';
import { listAllMedicinesForExport } from '$lib/server/db/queries/medicines';
import { listAllPushSubscriptionsForExport } from '$lib/server/db/queries/pushSubscriptions';
import { listAllSchedulesForExport } from '$lib/server/db/queries/schedules';
import { getUserById } from '$lib/server/db/queries/users';
import type { RequestHandler } from './$types';

// Deliberately unfiltered (drafts, archived medicines, every dose_log ever
// logged) — "export my data" means all of it, not just what the app
// currently surfaces. Push subscription endpoints/keys are included since
// they're the user's own data too, not a secret from them.
export const GET: RequestHandler = async ({ locals, platform, cookies }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	const [user, medicines, schedules, doseLogs, pushSubscriptions] = await Promise.all([
		getUserById(db, locals.user.id),
		listAllMedicinesForExport(db, locals.user.id),
		listAllSchedulesForExport(db, locals.user.id),
		listAllDoseLogsForExport(db, locals.user.id),
		listAllPushSubscriptionsForExport(db, locals.user.id)
	]);
	if (!user) return staleSession(cookies);

	return json(
		{
			exportedAt: new Date().toISOString(),
			user,
			medicines,
			schedules,
			doseLogs,
			pushSubscriptions
		},
		{
			headers: {
				'Content-Disposition': 'attachment; filename="medsassist-export.json"'
			}
		}
	);
};

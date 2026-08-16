import { json } from '@sveltejs/kit';
import { actOnDoseLog, undoDoseLog } from '$lib/server/db/queries/doseLogs';
import { getMedicineById } from '$lib/server/db/queries/medicines';
import { checkAndEnqueueSupplyAlert } from '$lib/server/push/supplyAlerts';
import type { RequestHandler } from './$types';

interface DoseLogActionBody {
	medicineId?: unknown;
	scheduledAt?: unknown;
	action?: unknown;
}

const VALID_ACTIONS = new Set(['take', 'skip', 'snooze', 'undo']);

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as DoseLogActionBody | null;
	if (
		typeof body?.medicineId !== 'string' ||
		typeof body?.scheduledAt !== 'string' ||
		typeof body?.action !== 'string' ||
		!VALID_ACTIONS.has(body.action)
	) {
		return json({ error: 'invalid_request' }, { status: 400 });
	}

	const db = platform!.env.DB;

	// Ownership check — medicineId in the body is client-supplied, so confirm
	// it actually belongs to the signed-in user before touching dose_logs.
	const medicine = await getMedicineById(db, locals.user.id, body.medicineId);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });

	if (body.action === 'undo') {
		const ok = await undoDoseLog(db, body.medicineId, body.scheduledAt);
		if (!ok) return json({ error: 'undo_window_expired' }, { status: 400 });
		return json({ ok: true });
	}

	const result = await actOnDoseLog(
		db,
		locals.user.id,
		body.medicineId,
		body.scheduledAt,
		body.action as 'take' | 'skip' | 'snooze'
	);
	if (!result.ok) return json({ error: result.reason }, { status: 400 });

	// Only 'take' changes supply — skip/snooze/undo never touch it, so only
	// 'take' can possibly cross a 7d/2d threshold.
	if (body.action === 'take') {
		const updated = await getMedicineById(db, locals.user.id, body.medicineId);
		if (updated) await checkAndEnqueueSupplyAlert(db, platform!.env.NOTIFY_QUEUE, updated);
	}

	return json({ ok: true, log: result.log });
};

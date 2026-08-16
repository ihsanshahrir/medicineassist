import { json } from '@sveltejs/kit';
import { refillMedicine } from '$lib/server/db/queries/medicines';
import { checkAndEnqueueSupplyAlert } from '$lib/server/push/supplyAlerts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
	if (typeof body?.amount !== 'number' || body.amount <= 0) {
		return json({ error: 'invalid_amount' }, { status: 400 });
	}

	const db = platform!.env.DB;
	const medicine = await refillMedicine(db, locals.user.id, params.id, body.amount);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });

	// refillMedicine already reset both alert flags — a refill can still leave
	// someone under the 7d/2d threshold (a too-small top-up), so re-check
	// rather than assuming a refill always clears the warning.
	await checkAndEnqueueSupplyAlert(db, platform!.env.NOTIFY_QUEUE, medicine);

	return json({ medicine });
};

import { json } from '@sveltejs/kit';
import { refillMedicine } from '$lib/server/db/queries/medicines';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
	if (typeof body?.amount !== 'number' || body.amount <= 0) {
		return json({ error: 'invalid_amount' }, { status: 400 });
	}

	const medicine = await refillMedicine(platform!.env.DB, locals.user.id, params.id, body.amount);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });
	return json({ medicine });
};

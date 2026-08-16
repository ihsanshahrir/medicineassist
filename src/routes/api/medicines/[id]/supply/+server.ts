import { json } from '@sveltejs/kit';
import { getMedicineById, setSupplyCount } from '$lib/server/db/queries/medicines';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	const medicine = await getMedicineById(db, locals.user.id, params.id);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });

	const body = (await request.json().catch(() => null)) as { count?: unknown } | null;
	if (typeof body?.count !== 'number' || body.count < 0) {
		return json({ error: 'invalid_count' }, { status: 400 });
	}

	await setSupplyCount(db, locals.user.id, medicine.id, body.count);
	return json({ ok: true });
};

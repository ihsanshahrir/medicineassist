import { json } from '@sveltejs/kit';
import { finalizeMedicineDraft, getMedicineById } from '$lib/server/db/queries/medicines';
import type { RequestHandler } from './$types';

// Called by the OCR wizard's Supply step ("Done") regardless of whether
// supply was entered — the one place is_draft flips 1->0, per the schema
// comment ("1 while mid Add-Medicine flow, 0 once Done").
export const POST: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	const medicine = await getMedicineById(db, locals.user.id, params.id);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });

	await finalizeMedicineDraft(db, locals.user.id, medicine.id);
	return json({ ok: true });
};

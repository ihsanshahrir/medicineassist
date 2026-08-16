import { json } from '@sveltejs/kit';
import { archiveMedicine, getMedicineById, updateMedicine } from '$lib/server/db/queries/medicines';
import { getScheduleWithTimes } from '$lib/server/db/queries/schedules';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;
	const medicine = await getMedicineById(db, locals.user.id, params.id);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });

	const schedule = await getScheduleWithTimes(db, medicine.id);
	return json({ medicine, schedule });
};

interface UpdateMedicineBody {
	name?: unknown;
	strength?: unknown;
	form?: unknown;
	whatFor?: unknown;
	instructionsText?: unknown;
	instructionTags?: unknown;
	warningTags?: unknown;
	notes?: unknown;
}

export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const body = (await request.json().catch(() => null)) as UpdateMedicineBody | null;
	if (!body) return json({ error: 'invalid_request' }, { status: 400 });

	const updated = await updateMedicine(platform!.env.DB, locals.user.id, params.id, {
		name: typeof body.name === 'string' ? body.name : undefined,
		strength:
			body.strength === null || typeof body.strength === 'string' ? body.strength : undefined,
		form: typeof body.form === 'string' ? body.form : undefined,
		whatFor: body.whatFor === null || typeof body.whatFor === 'string' ? body.whatFor : undefined,
		instructionsText:
			body.instructionsText === null || typeof body.instructionsText === 'string'
				? body.instructionsText
				: undefined,
		instructionTags: Array.isArray(body.instructionTags) ? body.instructionTags : undefined,
		warningTags: Array.isArray(body.warningTags) ? body.warningTags : undefined,
		notes: body.notes === null || typeof body.notes === 'string' ? body.notes : undefined
	});

	if (!updated) return json({ error: 'not_found' }, { status: 404 });
	return json({ medicine: updated });
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const ok = await archiveMedicine(platform!.env.DB, locals.user.id, params.id);
	if (!ok) return json({ error: 'not_found' }, { status: 404 });
	return json({ ok: true });
};

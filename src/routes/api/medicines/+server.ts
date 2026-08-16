import { json } from '@sveltejs/kit';
import { createMedicine, listMedicinesForUser } from '$lib/server/db/queries/medicines';
import { upsertSchedule } from '$lib/server/db/queries/schedules';
import { getUserById } from '$lib/server/db/queries/users';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const medicines = await listMedicinesForUser(platform!.env.DB, locals.user.id);
	return json({ medicines });
};

interface CreateMedicineBody {
	name?: unknown;
	strength?: unknown;
	form?: unknown;
	whatFor?: unknown;
	instructionsText?: unknown;
	instructionTags?: unknown;
	warningTags?: unknown;
	notes?: unknown;
	supplyCount?: unknown;
	// Optional — the manual-entry (M2) path creates medicine + schedule in one
	// call. The OCR wizard (M3) instead calls PUT .../schedule as its own
	// step, since its flow is staged across several screens.
	schedule?: {
		doseAmount?: unknown;
		doseUnit?: unknown;
		repeatType?: unknown;
		repeatIntervalDays?: unknown;
		weekdaysMask?: unknown;
		startDate?: unknown;
		endDate?: unknown;
		times?: Array<{ timeLocal?: unknown; anchorLabel?: unknown }>;
	};
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as CreateMedicineBody | null;
	if (typeof body?.name !== 'string' || !body.name.trim()) {
		return json({ error: 'name_required' }, { status: 400 });
	}

	const db = platform!.env.DB;
	const medicine = await createMedicine(db, locals.user.id, {
		name: body.name.trim(),
		strength: typeof body.strength === 'string' ? body.strength : null,
		form: typeof body.form === 'string' ? body.form : undefined,
		whatFor: typeof body.whatFor === 'string' ? body.whatFor : null,
		instructionsText: typeof body.instructionsText === 'string' ? body.instructionsText : null,
		instructionTags: Array.isArray(body.instructionTags) ? body.instructionTags : [],
		warningTags: Array.isArray(body.warningTags) ? body.warningTags : [],
		notes: typeof body.notes === 'string' ? body.notes : null,
		supplyCount: typeof body.supplyCount === 'number' ? body.supplyCount : null
	});

	const s = body.schedule;
	if (
		s &&
		typeof s.doseAmount === 'number' &&
		typeof s.doseUnit === 'string' &&
		typeof s.repeatType === 'string' &&
		typeof s.startDate === 'string' &&
		Array.isArray(s.times) &&
		s.times.length > 0
	) {
		const user = await getUserById(db, locals.user.id);
		await upsertSchedule(db, medicine.id, {
			doseAmount: s.doseAmount,
			doseUnit: s.doseUnit,
			repeatType: s.repeatType as 'daily' | 'every_n_days' | 'weekdays',
			repeatIntervalDays: typeof s.repeatIntervalDays === 'number' ? s.repeatIntervalDays : null,
			weekdaysMask: typeof s.weekdaysMask === 'number' ? s.weekdaysMask : null,
			startDate: s.startDate,
			endDate: typeof s.endDate === 'string' ? s.endDate : null,
			times: s.times
				.filter(
					(t): t is { timeLocal: string; anchorLabel?: string } => typeof t.timeLocal === 'string'
				)
				.map((t) => ({
					timeLocal: t.timeLocal,
					anchorLabel: typeof t.anchorLabel === 'string' ? t.anchorLabel : null
				})),
			tzOffsetMinutes: user?.tz_offset_minutes ?? 480
		});
	}

	return json({ medicine }, { status: 201 });
};

import { json } from '@sveltejs/kit';
import { getMedicineById } from '$lib/server/db/queries/medicines';
import { upsertSchedule } from '$lib/server/db/queries/schedules';
import { getUserById } from '$lib/server/db/queries/users';
import type { RequestHandler } from './$types';

interface ScheduleBody {
	doseAmount?: unknown;
	doseUnit?: unknown;
	repeatType?: unknown;
	repeatIntervalDays?: unknown;
	weekdaysMask?: unknown;
	startDate?: unknown;
	endDate?: unknown;
	times?: Array<{ timeLocal?: unknown; anchorLabel?: unknown }>;
}

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	// Ownership check before touching schedules — medicine_id alone isn't
	// enough to prove this user owns it.
	const medicine = await getMedicineById(db, locals.user.id, params.id);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });

	const body = (await request.json().catch(() => null)) as ScheduleBody | null;
	if (
		!body ||
		typeof body.doseAmount !== 'number' ||
		typeof body.doseUnit !== 'string' ||
		typeof body.repeatType !== 'string' ||
		typeof body.startDate !== 'string' ||
		!Array.isArray(body.times) ||
		body.times.length === 0
	) {
		return json({ error: 'invalid_schedule' }, { status: 400 });
	}

	const user = await getUserById(db, locals.user.id);
	const schedule = await upsertSchedule(db, medicine.id, {
		doseAmount: body.doseAmount,
		doseUnit: body.doseUnit,
		repeatType: body.repeatType as 'daily' | 'every_n_days' | 'weekdays',
		repeatIntervalDays:
			typeof body.repeatIntervalDays === 'number' ? body.repeatIntervalDays : null,
		weekdaysMask: typeof body.weekdaysMask === 'number' ? body.weekdaysMask : null,
		startDate: body.startDate,
		endDate: typeof body.endDate === 'string' ? body.endDate : null,
		times: body.times
			.filter(
				(t): t is { timeLocal: string; anchorLabel?: string } => typeof t.timeLocal === 'string'
			)
			.map((t) => ({
				timeLocal: t.timeLocal,
				anchorLabel: typeof t.anchorLabel === 'string' ? t.anchorLabel : null
			})),
		tzOffsetMinutes: user?.tz_offset_minutes ?? 480
	});

	return json({ schedule });
};

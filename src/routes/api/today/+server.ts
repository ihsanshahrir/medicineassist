import { json } from '@sveltejs/kit';
import { computeTodayOccurrences } from '$lib/server/db/queries/doseLogs';
import { listMedicinesForUser } from '$lib/server/db/queries/medicines';
import { listSchedulesForUser } from '$lib/server/db/queries/schedules';
import { getUserById } from '$lib/server/db/queries/users';
import { estimateAvgDailyDose } from '$lib/shared/scheduleOccurrence';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	const user = await getUserById(db, locals.user.id);
	const tzOffsetMinutes = user?.tz_offset_minutes ?? 480;

	const occurrences = await computeTodayOccurrences(db, locals.user.id, tzOffsetMinutes);

	const nowMs = Date.now();
	const NOW_WINDOW_MS = 30 * 60_000;
	const now = occurrences.filter(
		(o) =>
			o.status === 'pending' && Math.abs(new Date(o.scheduledAt).getTime() - nowMs) <= NOW_WINDOW_MS
	);
	const nowKeys = new Set(now.map((o) => `${o.medicineId}:${o.scheduledAt}`));
	const timeline = occurrences.filter((o) => !nowKeys.has(`${o.medicineId}:${o.scheduledAt}`));

	const medicines = await listMedicinesForUser(db, locals.user.id);
	const schedules = await listSchedulesForUser(db, locals.user.id);
	const supplyWarnings = medicines
		.filter((m) => m.supply_count !== null)
		.map((m) => {
			const schedule = schedules.get(m.id);
			const avgDaily = schedule
				? estimateAvgDailyDose({
						doseAmount: schedule.dose_amount,
						timesPerDay: schedule.times.length,
						repeatType: schedule.repeat_type as 'daily' | 'every_n_days' | 'weekdays',
						repeatIntervalDays: schedule.repeat_interval_days,
						weekdaysMask: schedule.weekdays_mask
					})
				: 0;
			const daysRemaining = avgDaily > 0 ? (m.supply_count ?? 0) / avgDaily : Infinity;
			return { medicineId: m.id, medicineName: m.name, daysRemaining: Math.floor(daysRemaining) };
		})
		.filter((w) => w.daysRemaining <= 7);

	return json({ now, timeline, supplyWarnings });
};

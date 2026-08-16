import { json } from '@sveltejs/kit';
import { computeTodayOccurrences } from '$lib/server/db/queries/doseLogs';
import { listMedicinesForUser } from '$lib/server/db/queries/medicines';
import { listSchedulesForUser } from '$lib/server/db/queries/schedules';
import { getUserById } from '$lib/server/db/queries/users';
import type { RequestHandler } from './$types';
import type { ScheduleWithTimes } from '$lib/server/db/queries/schedules';

// Average daily dose from the recurrence pattern — used only for the
// days-remaining estimate shown here. The push-triggering version of this
// same idea (event-driven 7d/2d alerts) is M5; this is display-only.
function estimateAvgDailyDose(schedule: ScheduleWithTimes): number {
	const perOccurrence = schedule.dose_amount * schedule.times.length;
	if (schedule.repeat_type === 'every_n_days') {
		return perOccurrence / (schedule.repeat_interval_days || 1);
	}
	if (schedule.repeat_type === 'weekdays') {
		const mask = schedule.weekdays_mask ?? 0;
		let activeDays = 0;
		for (let bit = 0; bit < 7; bit++) if ((mask >> bit) & 1) activeDays++;
		return perOccurrence * (activeDays / 7);
	}
	return perOccurrence; // daily
}

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
			const avgDaily = schedule ? estimateAvgDailyDose(schedule) : 0;
			const daysRemaining = avgDaily > 0 ? (m.supply_count ?? 0) / avgDaily : Infinity;
			return { medicineId: m.id, medicineName: m.name, daysRemaining: Math.floor(daysRemaining) };
		})
		.filter((w) => w.daysRemaining <= 7);

	return json({ now, timeline, supplyWarnings });
};

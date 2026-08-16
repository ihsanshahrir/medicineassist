import { timeLocalToUtc, type ScheduleLike } from '$lib/shared/scheduleOccurrence';

export interface ScheduleRow {
	id: string;
	medicine_id: string;
	dose_amount: number;
	dose_unit: string;
	repeat_type: string;
	repeat_interval_days: number | null;
	weekdays_mask: number | null;
	start_date: string;
	end_date: string | null;
}

export interface ScheduleTimeRow {
	id: string;
	schedule_id: string;
	time_local: string;
	time_utc: string;
	anchor_label: string | null;
}

export interface ScheduleWithTimes extends ScheduleRow {
	times: ScheduleTimeRow[];
}

export interface UpsertScheduleInput {
	doseAmount: number;
	doseUnit: string;
	repeatType: 'daily' | 'every_n_days' | 'weekdays';
	repeatIntervalDays?: number | null;
	weekdaysMask?: number | null;
	startDate: string;
	endDate?: string | null;
	times: Array<{ timeLocal: string; anchorLabel?: string | null }>;
	tzOffsetMinutes: number;
}

/** 1:1 with medicine — always fully replaces any existing schedule + times (no partial-patch API, matches the plan's PUT semantics). */
export async function upsertSchedule(
	db: D1Database,
	medicineId: string,
	input: UpsertScheduleInput
): Promise<ScheduleWithTimes> {
	const existing = await db
		.prepare('SELECT id FROM schedules WHERE medicine_id = ?')
		.bind(medicineId)
		.first<{ id: string }>();

	const scheduleId = existing?.id ?? crypto.randomUUID();

	if (existing) {
		await db
			.prepare(
				`UPDATE schedules SET
					dose_amount = ?, dose_unit = ?, repeat_type = ?, repeat_interval_days = ?,
					weekdays_mask = ?, start_date = ?, end_date = ?, updated_at = datetime('now')
				 WHERE id = ?`
			)
			.bind(
				input.doseAmount,
				input.doseUnit,
				input.repeatType,
				input.repeatIntervalDays ?? null,
				input.weekdaysMask ?? null,
				input.startDate,
				input.endDate ?? null,
				scheduleId
			)
			.run();
		await db.prepare('DELETE FROM schedule_times WHERE schedule_id = ?').bind(scheduleId).run();
	} else {
		await db
			.prepare(
				`INSERT INTO schedules
					(id, medicine_id, dose_amount, dose_unit, repeat_type, repeat_interval_days, weekdays_mask, start_date, end_date)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				scheduleId,
				medicineId,
				input.doseAmount,
				input.doseUnit,
				input.repeatType,
				input.repeatIntervalDays ?? null,
				input.weekdaysMask ?? null,
				input.startDate,
				input.endDate ?? null
			)
			.run();
	}

	for (const t of input.times) {
		await db
			.prepare(
				'INSERT INTO schedule_times (id, schedule_id, time_local, time_utc, anchor_label) VALUES (?, ?, ?, ?, ?)'
			)
			.bind(
				crypto.randomUUID(),
				scheduleId,
				t.timeLocal,
				timeLocalToUtc(t.timeLocal, input.tzOffsetMinutes),
				t.anchorLabel ?? null
			)
			.run();
	}

	const result = await getScheduleWithTimes(db, medicineId);
	if (!result) throw new Error('Schedule upsert succeeded but row is not readable');
	return result;
}

export async function getScheduleWithTimes(
	db: D1Database,
	medicineId: string
): Promise<ScheduleWithTimes | null> {
	const schedule = await db
		.prepare('SELECT * FROM schedules WHERE medicine_id = ?')
		.bind(medicineId)
		.first<ScheduleRow>();
	if (!schedule) return null;

	const { results } = await db
		.prepare('SELECT * FROM schedule_times WHERE schedule_id = ? ORDER BY time_local ASC')
		.bind(schedule.id)
		.all<ScheduleTimeRow>();

	return { ...schedule, times: results };
}

/** For all of a user's active medicines at once — what the Today computation needs, in one query instead of N+1. */
export async function listSchedulesForUser(
	db: D1Database,
	userId: string
): Promise<Map<string, ScheduleWithTimes>> {
	const { results: schedules } = await db
		.prepare(
			`SELECT s.* FROM schedules s
			 JOIN medicines m ON m.id = s.medicine_id
			 WHERE m.user_id = ? AND m.is_archived = 0 AND m.is_draft = 0`
		)
		.bind(userId)
		.all<ScheduleRow>();

	const map = new Map<string, ScheduleWithTimes>();
	for (const schedule of schedules) {
		const { results: times } = await db
			.prepare('SELECT * FROM schedule_times WHERE schedule_id = ? ORDER BY time_local ASC')
			.bind(schedule.id)
			.all<ScheduleTimeRow>();
		map.set(schedule.medicine_id, { ...schedule, times });
	}
	return map;
}

/** For GET /api/me/export. */
export async function listAllSchedulesForExport(
	db: D1Database,
	userId: string
): Promise<ScheduleWithTimes[]> {
	const { results: rows } = await db
		.prepare(
			`SELECT s.* FROM schedules s JOIN medicines m ON m.id = s.medicine_id WHERE m.user_id = ?`
		)
		.bind(userId)
		.all<ScheduleRow>();

	const withTimes: ScheduleWithTimes[] = [];
	for (const schedule of rows) {
		const { results: times } = await db
			.prepare('SELECT * FROM schedule_times WHERE schedule_id = ? ORDER BY time_local ASC')
			.bind(schedule.id)
			.all<ScheduleTimeRow>();
		withTimes.push({ ...schedule, times });
	}
	return withTimes;
}

export function toScheduleLike(row: ScheduleRow): ScheduleLike {
	return {
		repeatType: row.repeat_type as ScheduleLike['repeatType'],
		repeatIntervalDays: row.repeat_interval_days,
		weekdaysMask: row.weekdays_mask,
		startDate: row.start_date,
		endDate: row.end_date
	};
}

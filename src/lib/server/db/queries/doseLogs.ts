import {
	isScheduledOnLocalDate,
	localDateTimeToUtcIso,
	todayLocalDateStr
} from '$lib/shared/scheduleOccurrence';
import { listMedicinesForUser, decrementSupply } from './medicines';
import { listSchedulesForUser, toScheduleLike } from './schedules';
import type { ScheduleRow } from './schedules';

// dose_logs rows are NOT pre-materialized (see db/migrations/0001_init.sql's
// comment on the table) — this module computes "today" from the schedule on
// every read and lazily creates rows for occurrences that are due-or-past,
// exactly mirroring what workers/reminder-engine's cron (M4) will eventually
// do proactively. Until that cron exists, this on-read logic IS the only
// thing that creates dose_log rows, which is why every mutating action here
// also calls ensureDoseLog first — a client can act on an occurrence that
// was never rendered through computeTodayOccurrences (e.g. from a stale
// cached Today response) and still needs a row to update.
//
// Timestamp consistency note: scheduled_at/taken_at/snoozed_until are always
// full ISO 8601 strings (new Date().toISOString()), NOT SQLite's
// datetime('now') format (space-separated, no 'Z') — the latter is only used
// for created_at/updated_at, which nothing here parses back in JS. Mixing
// the two formats and parsing a datetime('now') string with `new Date()`
// silently misinterprets it as local time instead of UTC, so don't.

export interface DoseLogRow {
	id: string;
	user_id: string;
	medicine_id: string;
	schedule_id: string;
	scheduled_at: string;
	status: 'pending' | 'taken' | 'skipped' | 'snoozed' | 'missed';
	dose_amount: number;
	dose_unit: string;
	taken_at: string | null;
	snooze_count: number;
	snoozed_until: string | null;
	last_push_sent_at: string | null;
	followup_sent: number;
}

const MISSED_AFTER_MS = 3 * 60 * 60 * 1000; // matches the plan's cron "missed sweep" threshold
const SNOOZE_MINUTES = 15;
const SNOOZE_MAX = 2;
const UNDO_GRACE_MS = 30_000; // generous vs the PRD's 10s UI affordance, to absorb request latency

export interface TodayOccurrence {
	medicineId: string;
	medicineName: string;
	medicineStrength: string | null;
	accentIndex: number;
	doseAmount: number;
	doseUnit: string;
	scheduledAt: string;
	anchorLabel: string | null;
	status: DoseLogRow['status'];
	takenAt: string | null;
}

async function getDoseLog(
	db: D1Database,
	medicineId: string,
	scheduledAt: string
): Promise<DoseLogRow | null> {
	const row = await db
		.prepare('SELECT * FROM dose_logs WHERE medicine_id = ? AND scheduled_at = ?')
		.bind(medicineId, scheduledAt)
		.first<DoseLogRow>();
	return row ?? null;
}

async function materializeDueOccurrences(
	db: D1Database,
	userId: string,
	localDate: string,
	tzOffsetMinutes: number
): Promise<void> {
	const medicines = await listMedicinesForUser(db, userId);
	const schedules = await listSchedulesForUser(db, userId);
	const nowMs = Date.now();

	for (const medicine of medicines) {
		const schedule = schedules.get(medicine.id);
		if (!schedule) continue;
		if (!isScheduledOnLocalDate(toScheduleLike(schedule), localDate)) continue;

		for (const time of schedule.times) {
			const scheduledAt = localDateTimeToUtcIso(localDate, time.time_local, tzOffsetMinutes);
			if (new Date(scheduledAt).getTime() > nowMs) continue; // future — nothing to materialize yet

			const id = crypto.randomUUID();
			await db
				.prepare(
					`INSERT OR IGNORE INTO dose_logs
						(id, user_id, medicine_id, schedule_id, scheduled_at, dose_amount, dose_unit)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					id,
					userId,
					medicine.id,
					schedule.id,
					scheduledAt,
					schedule.dose_amount,
					schedule.dose_unit
				)
				.run();
		}
	}

	// Missed sweep, inlined here since no cron exists yet — identical rule to
	// the one workers/reminder-engine will run continuously in M4.
	await db
		.prepare(
			`UPDATE dose_logs SET status = 'missed', updated_at = datetime('now')
			 WHERE user_id = ? AND status IN ('pending', 'snoozed') AND scheduled_at < ?`
		)
		.bind(userId, new Date(nowMs - MISSED_AFTER_MS).toISOString())
		.run();

	// Snooze wake-up: an elapsed snooze goes back to pending so it resurfaces
	// in the Now group, same as the cron's query 3.
	await db
		.prepare(
			`UPDATE dose_logs SET status = 'pending', updated_at = datetime('now')
			 WHERE user_id = ? AND status = 'snoozed' AND snoozed_until <= ?`
		)
		.bind(userId, new Date(nowMs).toISOString())
		.run();
}

export async function computeTodayOccurrences(
	db: D1Database,
	userId: string,
	tzOffsetMinutes: number
): Promise<TodayOccurrence[]> {
	const localDate = todayLocalDateStr(tzOffsetMinutes);
	await materializeDueOccurrences(db, userId, localDate, tzOffsetMinutes);

	const medicines = await listMedicinesForUser(db, userId);
	const medicineById = new Map(medicines.map((m) => [m.id, m]));
	const schedules = await listSchedulesForUser(db, userId);

	const occurrences: TodayOccurrence[] = [];

	for (const medicine of medicines) {
		const schedule = schedules.get(medicine.id);
		if (!schedule) continue;
		if (!isScheduledOnLocalDate(toScheduleLike(schedule), localDate)) continue;

		for (const time of schedule.times) {
			const scheduledAt = localDateTimeToUtcIso(localDate, time.time_local, tzOffsetMinutes);
			const log = await getDoseLog(db, medicine.id, scheduledAt);
			const m = medicineById.get(medicine.id)!;

			occurrences.push({
				medicineId: medicine.id,
				medicineName: m.name,
				medicineStrength: m.strength,
				accentIndex: m.accent_index,
				doseAmount: schedule.dose_amount,
				doseUnit: schedule.dose_unit,
				scheduledAt,
				anchorLabel: time.anchor_label,
				status: log?.status ?? 'pending',
				takenAt: log?.taken_at ?? null
			});
		}
	}

	occurrences.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
	return occurrences;
}

async function ensureDoseLog(
	db: D1Database,
	userId: string,
	medicineId: string,
	scheduledAt: string
): Promise<DoseLogRow> {
	const existing = await getDoseLog(db, medicineId, scheduledAt);
	if (existing) return existing;

	const schedule = await db
		.prepare('SELECT * FROM schedules WHERE medicine_id = ?')
		.bind(medicineId)
		.first<ScheduleRow>();
	if (!schedule) throw new Error('No schedule exists for this medicine');

	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT OR IGNORE INTO dose_logs
				(id, user_id, medicine_id, schedule_id, scheduled_at, dose_amount, dose_unit)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			userId,
			medicineId,
			schedule.id,
			scheduledAt,
			schedule.dose_amount,
			schedule.dose_unit
		)
		.run();

	const created = await getDoseLog(db, medicineId, scheduledAt);
	if (!created) throw new Error('dose_log insert succeeded but row is not readable');
	return created;
}

export type DoseAction = 'take' | 'skip' | 'snooze';
export type ActOnDoseLogResult =
	{ ok: true; log: DoseLogRow } | { ok: false; reason: 'snooze_limit_reached' };

export async function actOnDoseLog(
	db: D1Database,
	userId: string,
	medicineId: string,
	scheduledAt: string,
	action: DoseAction
): Promise<ActOnDoseLogResult> {
	const log = await ensureDoseLog(db, userId, medicineId, scheduledAt);

	if (action === 'take') {
		const takenAt = new Date().toISOString();
		await db
			.prepare(
				`UPDATE dose_logs SET status = 'taken', taken_at = ?, updated_at = datetime('now') WHERE id = ?`
			)
			.bind(takenAt, log.id)
			.run();
		await decrementSupply(db, medicineId, log.dose_amount);
	} else if (action === 'skip') {
		await db
			.prepare(`UPDATE dose_logs SET status = 'skipped', updated_at = datetime('now') WHERE id = ?`)
			.bind(log.id)
			.run();
	} else if (action === 'snooze') {
		if (log.snooze_count >= SNOOZE_MAX) return { ok: false, reason: 'snooze_limit_reached' };
		const snoozedUntil = new Date(Date.now() + SNOOZE_MINUTES * 60_000).toISOString();
		await db
			.prepare(
				`UPDATE dose_logs SET status = 'snoozed', snoozed_until = ?, snooze_count = snooze_count + 1, updated_at = datetime('now')
				 WHERE id = ?`
			)
			.bind(snoozedUntil, log.id)
			.run();
	}

	const updated = await getDoseLog(db, medicineId, scheduledAt);
	return { ok: true, log: updated! };
}

/** Reverts a 'taken' dose back to 'pending' and restores supply — only within a short grace window after taking it. */
export async function undoDoseLog(
	db: D1Database,
	medicineId: string,
	scheduledAt: string
): Promise<boolean> {
	const log = await getDoseLog(db, medicineId, scheduledAt);
	if (!log || log.status !== 'taken' || !log.taken_at) return false;
	if (Date.now() - new Date(log.taken_at).getTime() > UNDO_GRACE_MS) return false;

	await db
		.prepare(
			`UPDATE dose_logs SET status = 'pending', taken_at = NULL, updated_at = datetime('now') WHERE id = ?`
		)
		.bind(log.id)
		.run();
	await decrementSupply(db, medicineId, -log.dose_amount); // restore: "decrement by a negative"
	return true;
}

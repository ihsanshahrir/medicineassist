import {
	isScheduledOnLocalDate,
	localDateTimeToUtcIso,
	todayLocalDateStr
} from '$lib/shared/scheduleOccurrence';
import { MISSED_AFTER_MS, SNOOZE_MAX, SNOOZE_MINUTES, UNDO_GRACE_MS } from '$lib/shared/doseState';
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

// How far back the on-read sweep reaches. workers/reminder-engine's cron sweeps
// globally every minute, so this path is only a safety net for a user whose
// doses went stale while the cron was down — without the bound, every Today
// load rewrites the user's entire dose history.
const SWEEP_LOOKBACK_MS = 48 * 60 * 60 * 1000;

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
	snoozedUntil: string | null;
	snoozeCount: number;
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

const logKey = (medicineId: string, scheduledAt: string) => `${medicineId}::${scheduledAt}`;

/** Every dose_log covering the given local day, in one query — the per-slot
 *  getDoseLog it replaces ran once per medicine per time-of-day. Bounded by the
 *  day window rather than an IN (...) list so the bind-parameter count stays
 *  constant no matter how many medicines the user takes. */
async function getDoseLogsForLocalDate(
	db: D1Database,
	userId: string,
	localDate: string,
	tzOffsetMinutes: number
): Promise<Map<string, DoseLogRow>> {
	const dayStart = localDateTimeToUtcIso(localDate, '00:00', tzOffsetMinutes);
	const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();

	const { results } = await db
		.prepare('SELECT * FROM dose_logs WHERE user_id = ? AND scheduled_at >= ? AND scheduled_at < ?')
		.bind(userId, dayStart, dayEnd)
		.all<DoseLogRow>();

	return new Map(results.map((r) => [logKey(r.medicine_id, r.scheduled_at), r]));
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

	const nowIso = new Date(nowMs).toISOString();

	// Snooze wake-up runs FIRST. An elapsed snooze goes back to pending so it
	// resurfaces in the Now group (same as the cron's query 3) — if the missed
	// sweep ran first it would flip such a row to 'missed', and this query's
	// `status = 'snoozed'` predicate would then no longer match it.
	await db
		.prepare(
			`UPDATE dose_logs SET status = 'pending', updated_at = datetime('now')
			 WHERE user_id = ? AND status = 'snoozed' AND snoozed_until <= ?`
		)
		.bind(userId, nowIso)
		.run();

	// Missed sweep — identical rule to workers/reminder-engine's query 4.
	// A snooze that has NOT elapsed is still live and must survive the sweep:
	// without the snoozed_until guard, snoozing a dose at the 2h59m mark marked
	// it missed a minute later, while its 15-minute snooze was still running.
	await db
		.prepare(
			`UPDATE dose_logs SET status = 'missed', updated_at = datetime('now')
			 WHERE user_id = ? AND status IN ('pending', 'snoozed')
			   AND scheduled_at < ? AND scheduled_at >= ?
			   AND (snoozed_until IS NULL OR snoozed_until <= ?)`
		)
		.bind(
			userId,
			new Date(nowMs - MISSED_AFTER_MS).toISOString(),
			new Date(nowMs - SWEEP_LOOKBACK_MS).toISOString(),
			nowIso
		)
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
	const logs = await getDoseLogsForLocalDate(db, userId, localDate, tzOffsetMinutes);

	const occurrences: TodayOccurrence[] = [];

	for (const medicine of medicines) {
		const schedule = schedules.get(medicine.id);
		if (!schedule) continue;
		if (!isScheduledOnLocalDate(toScheduleLike(schedule), localDate)) continue;

		for (const time of schedule.times) {
			const scheduledAt = localDateTimeToUtcIso(localDate, time.time_local, tzOffsetMinutes);
			const log = logs.get(logKey(medicine.id, scheduledAt)) ?? null;
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
				takenAt: log?.taken_at ?? null,
				snoozedUntil: log?.snoozed_until ?? null,
				snoozeCount: log?.snooze_count ?? 0
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
		// Only a transition INTO 'taken' consumes supply. Re-taking an already
		// taken dose (double tap, a retried request, an offline replay) must not
		// decrement a second time — undoDoseLog is the only thing that puts it back.
		if (log.status !== 'taken') await decrementSupply(db, medicineId, log.dose_amount);
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

/** Settings' Reminder-health row ("Last delivered 8:00 AM today") — the most
 *  recent time reminder-engine actually sent a push for this user, across
 *  every dose_log. Null if none ever has (never subscribed, or every send
 *  failed). */
export async function lastPushDeliveredAt(db: D1Database, userId: string): Promise<string | null> {
	const row = await db
		.prepare(
			'SELECT MAX(last_push_sent_at) as t FROM dose_logs WHERE user_id = ? AND last_push_sent_at IS NOT NULL'
		)
		.bind(userId)
		.first<{ t: string | null }>();
	return row?.t ?? null;
}

export async function listAllDoseLogsForExport(
	db: D1Database,
	userId: string
): Promise<DoseLogRow[]> {
	const { results } = await db
		.prepare('SELECT * FROM dose_logs WHERE user_id = ? ORDER BY scheduled_at ASC')
		.bind(userId)
		.all<DoseLogRow>();
	return results;
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

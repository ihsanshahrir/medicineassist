// The cron's four queries, exactly as specified in the plan's "Reminder
// pipeline — exact flow" section. Runs every minute (wrangler.jsonc's
// `* * * * *` trigger) via index.ts's scheduled() export.
import {
	isScheduledOnLocalDate,
	localDateTimeToUtcIso,
	todayLocalDateStr
} from '../../../src/lib/shared/scheduleOccurrence';
import {
	createDoseLogIfMissing,
	findDueFollowUps,
	findDueSchedules,
	findElapsedSnoozes,
	markFollowUpSent,
	sweepMissedDoseLogs,
	wakeSnoozedDose
} from './db';
import type { QueueMessage } from './types';

const MISSED_AFTER_MS = 3 * 60 * 60 * 1000;
const FOLLOWUP_WINDOW_MS = 30 * 60 * 1000; // "30-31 min old" per the plan — a 1-tick-wide catch window
const FOLLOWUP_WINDOW_WIDTH_MS = 60 * 1000;

function nowUtcHHMM(now: Date): string {
	return now.toISOString().slice(11, 16);
}

/** Handles the overnight-wraparound case (e.g. 22:00-07:00) the same way schedule anchors do. */
function isWithinQuietHours(
	nowHHMM: string,
	startUtc: string | null,
	endUtc: string | null
): boolean {
	if (!startUtc || !endUtc) return false;
	if (startUtc <= endUtc) return nowHHMM >= startUtc && nowHHMM < endUtc;
	return nowHHMM >= startUtc || nowHHMM < endUtc;
}

async function scanDueNow(db: D1Database, queue: Queue<QueueMessage>, now: Date): Promise<void> {
	const hhmm = nowUtcHHMM(now);
	const candidates = await findDueSchedules(db, hhmm);

	for (const row of candidates) {
		const localDate = todayLocalDateStr(row.tz_offset_minutes);
		const isDue = isScheduledOnLocalDate(
			{
				repeatType: row.repeat_type,
				repeatIntervalDays: row.repeat_interval_days,
				weekdaysMask: row.weekdays_mask,
				startDate: row.start_date,
				endDate: row.end_date
			},
			localDate
		);
		if (!isDue) continue;

		const scheduledAt = localDateTimeToUtcIso(localDate, row.time_local, row.tz_offset_minutes);
		const { id, created } = await createDoseLogIfMissing(db, {
			userId: row.user_id,
			medicineId: row.medicine_id,
			scheduleId: row.schedule_id,
			scheduledAt,
			doseAmount: row.dose_amount,
			doseUnit: row.dose_unit
		});
		if (!created) continue; // already handled by an earlier tick

		// Quiet-hour doses still get their dose_log (so they show up in-app),
		// just no push — per the plan, quiet-hour doses surface in-app only.
		if (isWithinQuietHours(hhmm, row.quiet_hours_start_utc, row.quiet_hours_end_utc)) continue;

		await queue.send({
			type: 'dose_reminder',
			dose_log_id: id,
			user_id: row.user_id,
			medicine_id: row.medicine_id,
			medicine_name: row.medicine_name,
			dose_amount: row.dose_amount,
			dose_unit: row.dose_unit,
			scheduled_at: scheduledAt
		});
	}
}

async function scanFollowUps(db: D1Database, queue: Queue<QueueMessage>, now: Date): Promise<void> {
	// "30-31 min old": scheduled_at falls in (now-31min, now-30min].
	const newerBound = new Date(now.getTime() - FOLLOWUP_WINDOW_MS).toISOString();
	const olderBound = new Date(
		now.getTime() - FOLLOWUP_WINDOW_MS - FOLLOWUP_WINDOW_WIDTH_MS
	).toISOString();

	const due = await findDueFollowUps(db, newerBound, olderBound);
	for (const log of due) {
		await queue.send({
			type: 'dose_followup',
			dose_log_id: log.id,
			user_id: log.user_id,
			medicine_id: log.medicine_id,
			medicine_name: log.medicine_name,
			dose_amount: log.dose_amount,
			dose_unit: log.dose_unit,
			scheduled_at: log.scheduled_at
		});
		await markFollowUpSent(db, log.id);
	}
}

async function scanSnoozeWakeups(
	db: D1Database,
	queue: Queue<QueueMessage>,
	now: Date
): Promise<void> {
	const elapsed = await findElapsedSnoozes(db, now.toISOString());
	for (const log of elapsed) {
		await queue.send({
			type: 'dose_reminder',
			dose_log_id: log.id,
			user_id: log.user_id,
			medicine_id: log.medicine_id,
			medicine_name: log.medicine_name,
			dose_amount: log.dose_amount,
			dose_unit: log.dose_unit,
			scheduled_at: log.scheduled_at
		});
		await wakeSnoozedDose(db, log.id);
	}
}

async function scanMissed(db: D1Database, now: Date): Promise<void> {
	const threshold = new Date(now.getTime() - MISSED_AFTER_MS).toISOString();
	await sweepMissedDoseLogs(db, threshold);
}

export async function runScan(env: Env): Promise<void> {
	const now = new Date();
	await scanDueNow(env.DB, env.NOTIFY_QUEUE, now);
	await scanFollowUps(env.DB, env.NOTIFY_QUEUE, now);
	await scanSnoozeWakeups(env.DB, env.NOTIFY_QUEUE, now);
	await scanMissed(env.DB, now);
}

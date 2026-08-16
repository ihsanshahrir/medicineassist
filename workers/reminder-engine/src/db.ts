// Hand-written D1 queries, same style as the main app's src/lib/server/db/queries/*
// (no ORM, no cross-project import of those files — this is a separate
// Worker bundle with its own build, so it keeps its own minimal copy of just
// what the cron scan and push consumer need).

export interface DueScheduleRow {
	time_local: string;
	time_utc: string;
	anchor_label: string | null;
	schedule_id: string;
	dose_amount: number;
	dose_unit: string;
	repeat_type: 'daily' | 'every_n_days' | 'weekdays';
	repeat_interval_days: number | null;
	weekdays_mask: number | null;
	start_date: string;
	end_date: string | null;
	medicine_id: string;
	medicine_name: string;
	user_id: string;
	tz_offset_minutes: number;
	quiet_hours_start_utc: string | null;
	quiet_hours_end_utc: string | null;
}

/** Candidates whose schedule_times.time_utc matches this exact UTC minute —
 *  the indexed lookup idx_schedule_times_utc exists for exactly this query.
 *  Still needs isScheduledOnLocalDate() filtering per row in scan.ts, since
 *  a bare HH:MM match doesn't know repeat_type/weekdays/date range. */
export async function findDueSchedules(
	db: D1Database,
	nowUtcHHMM: string
): Promise<DueScheduleRow[]> {
	const { results } = await db
		.prepare(
			`SELECT
				st.time_local, st.time_utc, st.anchor_label,
				sc.id as schedule_id, sc.dose_amount, sc.dose_unit, sc.repeat_type,
				sc.repeat_interval_days, sc.weekdays_mask, sc.start_date, sc.end_date,
				m.id as medicine_id, m.name as medicine_name, m.user_id,
				u.tz_offset_minutes, u.quiet_hours_start_utc, u.quiet_hours_end_utc
			 FROM schedule_times st
			 JOIN schedules sc ON sc.id = st.schedule_id
			 JOIN medicines m ON m.id = sc.medicine_id
			 JOIN users u ON u.id = m.user_id
			 WHERE st.time_utc = ? AND m.is_archived = 0 AND m.is_draft = 0`
		)
		.bind(nowUtcHHMM)
		.all<DueScheduleRow>();
	return results;
}

/** INSERT OR IGNORE — the schema's UNIQUE(medicine_id, scheduled_at) makes this
 *  idempotent-safe if the cron ever double-processes a minute. Returns true
 *  only when a row was actually newly created (so the caller enqueues a push
 *  exactly once, not once per redundant tick). */
export async function createDoseLogIfMissing(
	db: D1Database,
	row: {
		userId: string;
		medicineId: string;
		scheduleId: string;
		scheduledAt: string;
		doseAmount: number;
		doseUnit: string;
	}
): Promise<{ id: string; created: boolean }> {
	const id = crypto.randomUUID();
	const result = await db
		.prepare(
			`INSERT OR IGNORE INTO dose_logs
				(id, user_id, medicine_id, schedule_id, scheduled_at, dose_amount, dose_unit)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			row.userId,
			row.medicineId,
			row.scheduleId,
			row.scheduledAt,
			row.doseAmount,
			row.doseUnit
		)
		.run();

	if (result.meta.changes > 0) return { id, created: true };

	// Someone else's tick beat us to it — fetch the id that actually exists.
	const existing = await db
		.prepare('SELECT id FROM dose_logs WHERE medicine_id = ? AND scheduled_at = ?')
		.bind(row.medicineId, row.scheduledAt)
		.first<{ id: string }>();
	return { id: existing!.id, created: false };
}

export interface PendingDoseLogRow {
	id: string;
	user_id: string;
	medicine_id: string;
	medicine_name: string;
	dose_amount: number;
	dose_unit: string;
	scheduled_at: string;
}

/** Query 2 — pending, no follow-up sent yet, scheduled_at in (olderBoundIso, newerBoundIso]. */
export async function findDueFollowUps(
	db: D1Database,
	newerBoundIso: string,
	olderBoundIso: string
): Promise<PendingDoseLogRow[]> {
	const { results } = await db
		.prepare(
			`SELECT dl.id, dl.user_id, dl.medicine_id, m.name as medicine_name,
				dl.dose_amount, dl.dose_unit, dl.scheduled_at
			 FROM dose_logs dl JOIN medicines m ON m.id = dl.medicine_id
			 WHERE dl.status = 'pending' AND dl.followup_sent = 0
			   AND dl.scheduled_at <= ? AND dl.scheduled_at > ?`
		)
		.bind(newerBoundIso, olderBoundIso)
		.all<PendingDoseLogRow>();
	return results;
}

/** Settings' Reminder-health row ("Last delivered...") reads this back via
 *  the root app's lastPushDeliveredAt query — set after an actual send
 *  attempt, in index.ts's queue() handler, not here in the scan.
 *
 *  Bound as a real ISO string, deliberately NOT SQL's datetime('now') — every
 *  other instant column in dose_logs (scheduled_at, taken_at, snoozed_until)
 *  is a full ISO string too, and the main app's doseLogs.ts warns explicitly
 *  against mixing the two formats (datetime('now')'s space-separated,
 *  no-'Z' format parses as local time, not UTC, if you ever pass it through
 *  `new Date()` — which the Settings page's display formatting does). */
export async function markPushSent(db: D1Database, doseLogId: string): Promise<void> {
	await db
		.prepare(`UPDATE dose_logs SET last_push_sent_at = ? WHERE id = ?`)
		.bind(new Date().toISOString(), doseLogId)
		.run();
}

export async function markFollowUpSent(db: D1Database, doseLogId: string): Promise<void> {
	await db
		.prepare(`UPDATE dose_logs SET followup_sent = 1, updated_at = datetime('now') WHERE id = ?`)
		.bind(doseLogId)
		.run();
}

/** Query 3 — snoozed doses whose snooze window just elapsed. */
export async function findElapsedSnoozes(
	db: D1Database,
	nowIso: string
): Promise<PendingDoseLogRow[]> {
	const { results } = await db
		.prepare(
			`SELECT dl.id, dl.user_id, dl.medicine_id, m.name as medicine_name,
				dl.dose_amount, dl.dose_unit, dl.scheduled_at
			 FROM dose_logs dl JOIN medicines m ON m.id = dl.medicine_id
			 WHERE dl.status = 'snoozed' AND dl.snoozed_until <= ?`
		)
		.bind(nowIso)
		.all<PendingDoseLogRow>();
	return results;
}

export async function wakeSnoozedDose(db: D1Database, doseLogId: string): Promise<void> {
	await db
		.prepare(`UPDATE dose_logs SET status = 'pending', updated_at = datetime('now') WHERE id = ?`)
		.bind(doseLogId)
		.run();
}

/** Query 4 — bounds the "open" set; anything more recent is still live for the app's own Today computation to treat as missed. */
export async function sweepMissedDoseLogs(db: D1Database, thresholdIso: string): Promise<number> {
	const result = await db
		.prepare(
			`UPDATE dose_logs SET status = 'missed', updated_at = datetime('now')
			 WHERE status IN ('pending', 'snoozed') AND scheduled_at < ?`
		)
		.bind(thresholdIso)
		.run();
	return result.meta.changes;
}

export interface PushSubscriptionRow {
	id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
}

export async function listPushSubscriptionsForUser(
	db: D1Database,
	userId: string
): Promise<PushSubscriptionRow[]> {
	const { results } = await db
		.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?')
		.bind(userId)
		.all<PushSubscriptionRow>();
	return results;
}

export async function deletePushSubscription(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(id).run();
}

// Hand-written D1 queries, no ORM (matches the plan's decision to keep the
// D1 read/write budget legible and avoid an extra dependency for a schema
// this small). One row shape mirrors db/migrations/0001_init.sql exactly.
import { timeLocalToUtc } from '$lib/shared/scheduleOccurrence';

export interface UserRow {
	id: string;
	email: string;
	language: string;
	text_size: string;
	timezone: string;
	tz_offset_minutes: number;
	quiet_hours_start_local: string | null;
	quiet_hours_end_local: string | null;
	quiet_hours_start_utc: string | null;
	quiet_hours_end_utc: string | null;
	created_at: string;
	updated_at: string;
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
	const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
	return row ?? null;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
	const row = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
	return row ?? null;
}

export interface UpdateUserSettingsInput {
	language?: 'en' | 'ms';
	textSize?: 'normal' | 'large' | 'xl';
	/** Both-or-neither: a null pair clears quiet hours entirely. */
	quietHours?: { startLocal: string; endLocal: string } | null;
}

export async function updateUserSettings(
	db: D1Database,
	userId: string,
	input: UpdateUserSettingsInput
): Promise<UserRow | null> {
	const existing = await getUserById(db, userId);
	if (!existing) return null;

	const quietStartLocal =
		input.quietHours !== undefined
			? (input.quietHours?.startLocal ?? null)
			: existing.quiet_hours_start_local;
	const quietEndLocal =
		input.quietHours !== undefined
			? (input.quietHours?.endLocal ?? null)
			: existing.quiet_hours_end_local;
	// Recomputed from local + offset on every save, same precompute pattern as
	// schedule_times.time_utc — keeps the cron's read path a plain string
	// comparison instead of per-tick timezone math.
	const tzOffset = existing.tz_offset_minutes;
	const quietStartUtc = quietStartLocal ? timeLocalToUtc(quietStartLocal, tzOffset) : null;
	const quietEndUtc = quietEndLocal ? timeLocalToUtc(quietEndLocal, tzOffset) : null;

	await db
		.prepare(
			`UPDATE users SET
				language = ?, text_size = ?,
				quiet_hours_start_local = ?, quiet_hours_end_local = ?,
				quiet_hours_start_utc = ?, quiet_hours_end_utc = ?,
				updated_at = datetime('now')
			 WHERE id = ?`
		)
		.bind(
			input.language ?? existing.language,
			input.textSize ?? existing.text_size,
			quietStartLocal,
			quietEndLocal,
			quietStartUtc,
			quietEndUtc,
			userId
		)
		.run();

	return getUserById(db, userId);
}

/** Cascades via the schema's ON DELETE CASCADE — medicines, schedules,
 *  schedule_times, dose_logs, and push_subscriptions all go with it. No
 *  session table to clean up (stateless HMAC cookie — the route handler
 *  clears the cookie itself). */
export async function deleteUser(db: D1Database, userId: string): Promise<void> {
	await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}

/** Idempotent — first OTP verify for a new email creates the account, every later one just logs in. */
export async function upsertUserByEmail(db: D1Database, email: string): Promise<UserRow> {
	const existing = await getUserByEmail(db, email);
	if (existing) return existing;

	const id = crypto.randomUUID();
	await db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(id, email).run();
	const created = await getUserById(db, id);
	if (!created) throw new Error('User insert succeeded but row is not readable');
	return created;
}

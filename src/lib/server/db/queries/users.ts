// Hand-written D1 queries, no ORM (matches the plan's decision to keep the
// D1 read/write budget legible and avoid an extra dependency for a schema
// this small). One row shape mirrors db/migrations/0001_init.sql exactly.

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

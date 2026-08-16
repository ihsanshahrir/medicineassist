export interface PushSubscriptionRow {
	id: string;
	user_id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	user_agent: string | null;
	installed_as_pwa: number;
	created_at: string;
	last_seen_at: string;
}

/** Keyed on `endpoint` (UNIQUE in the schema) so re-subscribing the same
 *  browser/device — e.g. after a permission re-grant — updates in place
 *  rather than accumulating duplicate rows. */
export async function upsertPushSubscription(
	db: D1Database,
	userId: string,
	input: {
		endpoint: string;
		p256dh: string;
		auth: string;
		userAgent: string | null;
		installedAsPwa: boolean;
	}
): Promise<void> {
	const existing = await db
		.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?')
		.bind(input.endpoint)
		.first<{ id: string }>();

	if (existing) {
		await db
			.prepare(
				`UPDATE push_subscriptions SET
					user_id = ?, p256dh = ?, auth = ?, user_agent = ?, installed_as_pwa = ?, last_seen_at = datetime('now')
				 WHERE id = ?`
			)
			.bind(
				userId,
				input.p256dh,
				input.auth,
				input.userAgent,
				input.installedAsPwa ? 1 : 0,
				existing.id
			)
			.run();
		return;
	}

	await db
		.prepare(
			`INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, installed_as_pwa)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			crypto.randomUUID(),
			userId,
			input.endpoint,
			input.p256dh,
			input.auth,
			input.userAgent,
			input.installedAsPwa ? 1 : 0
		)
		.run();
}

export async function removePushSubscription(
	db: D1Database,
	userId: string,
	endpoint: string
): Promise<void> {
	await db
		.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
		.bind(userId, endpoint)
		.run();
}

export async function hasPushSubscription(db: D1Database, userId: string): Promise<boolean> {
	const row = await db
		.prepare('SELECT 1 as x FROM push_subscriptions WHERE user_id = ? LIMIT 1')
		.bind(userId)
		.first<{ x: number }>();
	return row !== null;
}

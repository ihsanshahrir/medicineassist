// M7 quota monitoring — daily counters checked manually against Cloudflare's
// free-tier ceilings, see db/README.md. No admin UI; this is intentionally
// just a counter table (matches usage_counters' own comment in the migration).

export type UsageCounterName = 'ocr_calls' | 'push_attempts' | 'push_failures';

export async function incrementUsageCounter(db: D1Database, name: UsageCounterName): Promise<void> {
	await db
		.prepare(
			`INSERT INTO usage_counters (counter_date, counter_name, count)
			 VALUES (date('now'), ?, 1)
			 ON CONFLICT(counter_date, counter_name) DO UPDATE SET count = count + 1`
		)
		.bind(name)
		.run();
}

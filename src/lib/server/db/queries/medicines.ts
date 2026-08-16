// Every query here takes userId and scopes by it in the WHERE clause — never
// trust a route param alone for row ownership (see the API routes: they all
// pass locals.user.id through to these functions rather than the request body).

export interface MedicineRow {
	id: string;
	user_id: string;
	name: string;
	strength: string | null;
	form: string;
	what_for: string | null;
	instructions_text: string | null;
	instruction_tags: string; // JSON array, stored as text
	warning_tags: string; // JSON array, stored as text
	notes: string | null;
	accent_index: number;
	pill_photo_key: string | null;
	label_photo_key: string | null;
	ocr_source: string | null;
	supply_count: number | null;
	supply_alert_7d_sent: number;
	supply_alert_2d_sent: number;
	last_refill_at: string | null;
	last_refill_amount: number | null;
	is_draft: number;
	is_archived: number;
	created_at: string;
	updated_at: string;
}

export interface CreateMedicineInput {
	name: string;
	strength?: string | null;
	form?: string;
	whatFor?: string | null;
	instructionsText?: string | null;
	instructionTags?: string[];
	warningTags?: string[];
	notes?: string | null;
	supplyCount?: number | null;
	/** True for the OCR wizard's first step, which creates the row before any
	 *  fields are confirmed — see `is_draft` in the schema. Manual entry (M2)
	 *  omits this and gets the immediate is_draft=0 it always had. */
	isDraft?: boolean;
}

// Round-robin accent assignment: count existing (non-archived) medicines for
// the user and take the next one — matches design/colors_and_type.css's
// 8-hue --accent-1..8 scale, no state to track beyond "how many so far".
async function nextAccentIndex(db: D1Database, userId: string): Promise<number> {
	const row = await db
		.prepare('SELECT COUNT(*) as n FROM medicines WHERE user_id = ? AND is_archived = 0')
		.bind(userId)
		.first<{ n: number }>();
	return ((row?.n ?? 0) % 8) + 1;
}

export async function createMedicine(
	db: D1Database,
	userId: string,
	input: CreateMedicineInput
): Promise<MedicineRow> {
	const id = crypto.randomUUID();
	const accentIndex = await nextAccentIndex(db, userId);

	await db
		.prepare(
			`INSERT INTO medicines
				(id, user_id, name, strength, form, what_for, instructions_text,
				 instruction_tags, warning_tags, notes, accent_index, supply_count, is_draft)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			userId,
			input.name,
			input.strength ?? null,
			input.form ?? 'tablet',
			input.whatFor ?? null,
			input.instructionsText ?? null,
			JSON.stringify(input.instructionTags ?? []),
			JSON.stringify(input.warningTags ?? []),
			input.notes ?? null,
			accentIndex,
			input.supplyCount ?? null,
			input.isDraft ? 1 : 0
		)
		.run();

	const created = await getMedicineById(db, userId, id);
	if (!created) throw new Error('Medicine insert succeeded but row is not readable');
	return created;
}

export async function getMedicineById(
	db: D1Database,
	userId: string,
	id: string
): Promise<MedicineRow | null> {
	const row = await db
		.prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ?')
		.bind(id, userId)
		.first<MedicineRow>();
	return row ?? null;
}

// is_draft = 0 excludes mid-flow OCR drafts (M3) from ever showing on Today
// or the medicines list — manual entry (M2) sets is_draft = 0 immediately,
// so this has no effect yet but matters as soon as the OCR wizard lands.
export async function listMedicinesForUser(db: D1Database, userId: string): Promise<MedicineRow[]> {
	const { results } = await db
		.prepare(
			'SELECT * FROM medicines WHERE user_id = ? AND is_archived = 0 AND is_draft = 0 ORDER BY created_at ASC'
		)
		.bind(userId)
		.all<MedicineRow>();
	return results;
}

export interface UpdateMedicineInput {
	name?: string;
	strength?: string | null;
	form?: string;
	whatFor?: string | null;
	instructionsText?: string | null;
	instructionTags?: string[];
	warningTags?: string[];
	notes?: string | null;
}

export async function updateMedicine(
	db: D1Database,
	userId: string,
	id: string,
	input: UpdateMedicineInput
): Promise<MedicineRow | null> {
	const existing = await getMedicineById(db, userId, id);
	if (!existing) return null;

	await db
		.prepare(
			`UPDATE medicines SET
				name = ?, strength = ?, form = ?, what_for = ?, instructions_text = ?,
				instruction_tags = ?, warning_tags = ?, notes = ?, updated_at = datetime('now')
			 WHERE id = ? AND user_id = ?`
		)
		.bind(
			input.name ?? existing.name,
			input.strength !== undefined ? input.strength : existing.strength,
			input.form ?? existing.form,
			input.whatFor !== undefined ? input.whatFor : existing.what_for,
			input.instructionsText !== undefined ? input.instructionsText : existing.instructions_text,
			input.instructionTags ? JSON.stringify(input.instructionTags) : existing.instruction_tags,
			input.warningTags ? JSON.stringify(input.warningTags) : existing.warning_tags,
			input.notes !== undefined ? input.notes : existing.notes,
			id,
			userId
		)
		.run();

	return getMedicineById(db, userId, id);
}

export async function archiveMedicine(
	db: D1Database,
	userId: string,
	id: string
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE medicines SET is_archived = 1, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
		)
		.bind(id, userId)
		.run();
	return result.meta.changes > 0;
}

export async function setPhotoKey(
	db: D1Database,
	userId: string,
	id: string,
	kind: 'pill' | 'label',
	key: string
): Promise<void> {
	const column = kind === 'pill' ? 'pill_photo_key' : 'label_photo_key';
	// A fresh label photo invalidates any cached ocr_source from a prior
	// attempt (see POST .../ocr's cache-reuse) — otherwise a retake after a
	// failed or bad read would just replay the stale extraction.
	const extraClear = kind === 'label' ? ', ocr_source = NULL' : '';
	await db
		.prepare(
			`UPDATE medicines SET ${column} = ?${extraClear}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
		)
		.bind(key, id, userId)
		.run();
}

export async function setOcrSource(
	db: D1Database,
	userId: string,
	id: string,
	ocrSourceJson: string
): Promise<void> {
	await db
		.prepare(
			`UPDATE medicines SET ocr_source = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
		)
		.bind(ocrSourceJson, id, userId)
		.run();
}

/** Flips is_draft 1→0 — the OCR wizard's Supply step (its last, "Done") calls
 *  this regardless of whether supply was entered, since that's optional. */
export async function finalizeMedicineDraft(
	db: D1Database,
	userId: string,
	id: string
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE medicines SET is_draft = 0, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
		)
		.bind(id, userId)
		.run();
	return result.meta.changes > 0;
}

export async function setSupplyCount(
	db: D1Database,
	userId: string,
	id: string,
	count: number
): Promise<void> {
	await db
		.prepare(
			`UPDATE medicines SET supply_count = ?, supply_alert_7d_sent = 0, supply_alert_2d_sent = 0, updated_at = datetime('now')
			 WHERE id = ? AND user_id = ?`
		)
		.bind(count, id, userId)
		.run();
}

/** Adds `amount` to the current supply and resets both alert flags — a refill always clears prior warnings. */
export async function refillMedicine(
	db: D1Database,
	userId: string,
	id: string,
	amount: number
): Promise<MedicineRow | null> {
	const existing = await getMedicineById(db, userId, id);
	if (!existing) return null;

	const newCount = (existing.supply_count ?? 0) + amount;
	await db
		.prepare(
			`UPDATE medicines SET
				supply_count = ?, supply_alert_7d_sent = 0, supply_alert_2d_sent = 0,
				last_refill_at = datetime('now'), last_refill_amount = ?, updated_at = datetime('now')
			 WHERE id = ? AND user_id = ?`
		)
		.bind(newCount, amount, id, userId)
		.run();

	return getMedicineById(db, userId, id);
}

/** Decrements supply by the given dose amount, floored at 0. Used when a dose is marked taken. */
export async function decrementSupply(
	db: D1Database,
	medicineId: string,
	amount: number
): Promise<void> {
	// WHERE supply_count IS NOT NULL matters: NULL means "not tracked" (per
	// the schema comment), and without this guard a take/undo on an
	// untracked medicine would silently turn that NULL into a real "0 left"
	// — floored at 0 only for decreases, so undo's negative-amount restore
	// still works correctly for medicines that ARE tracked.
	await db
		.prepare(
			`UPDATE medicines SET supply_count = MAX(0, supply_count - ?), updated_at = datetime('now')
			 WHERE id = ? AND supply_count IS NOT NULL`
		)
		.bind(amount, medicineId)
		.run();
}

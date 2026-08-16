import { json } from '@sveltejs/kit';
import { getMedicineById, setOcrSource } from '$lib/server/db/queries/medicines';
import { incrementUsageCounter } from '$lib/server/db/queries/usageCounters';
import { extractFromLabelPhoto, FAILED_RESULT, type OcrResult } from '$lib/server/ocr/extract';
import { checkAndIncrement } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// Model calls cost real Workers AI Neuron quota; this bounds how many a
// single user can trigger per hour (cache hits below don't count against it).
const OCR_LIMIT = 20;
const OCR_WINDOW_SECONDS = 3600;

export const POST: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	const medicine = await getMedicineById(db, locals.user.id, params.id);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });
	if (!medicine.label_photo_key) return json({ error: 'no_label_photo' }, { status: 400 });

	// Re-running inference costs real Workers AI quota, so a re-visit of the
	// Confirm screen (refresh, back/forward) reuses the stored result instead
	// of calling the model again — ocr_source doubles as this cache and as
	// the "original extraction" audit trail the PRD requires. A cached
	// *failure* isn't reused though — retry on refresh instead of replaying
	// a stale ocrFailed result forever.
	if (medicine.ocr_source) {
		const cached = JSON.parse(medicine.ocr_source) as OcrResult;
		if (!cached.ocrFailed) return json(cached);
	}

	const allowed = await checkAndIncrement(
		platform!.env.OTP_KV,
		`ocr_rl:${locals.user.id}`,
		OCR_LIMIT,
		OCR_WINDOW_SECONDS
	);
	if (!allowed) return json({ error: 'rate_limited' }, { status: 429 });

	let photoBytes: ArrayBuffer;
	let contentType: string;
	try {
		const object = await platform!.env.PHOTOS.get(medicine.label_photo_key);
		if (!object) return json({ error: 'no_label_photo' }, { status: 400 });
		photoBytes = await object.arrayBuffer();
		contentType = object.httpMetadata?.contentType ?? 'image/jpeg';
	} catch {
		await setOcrSource(db, locals.user.id, medicine.id, JSON.stringify(FAILED_RESULT));
		return json(FAILED_RESULT);
	}

	await incrementUsageCounter(db, 'ocr_calls');
	const result = await extractFromLabelPhoto(platform!.env.AI, photoBytes, contentType);

	await setOcrSource(db, locals.user.id, medicine.id, JSON.stringify(result));
	return json(result);
};

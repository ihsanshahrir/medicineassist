import { json } from '@sveltejs/kit';
import { getMedicineById, setOcrSource } from '$lib/server/db/queries/medicines';
import { extractFromLabelPhoto, type OcrResult } from '$lib/server/ocr/extract';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	const medicine = await getMedicineById(db, locals.user.id, params.id);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });
	if (!medicine.label_photo_key) return json({ error: 'no_label_photo' }, { status: 400 });

	// Re-running inference costs real Workers AI quota, so a re-visit of the
	// Confirm screen (refresh, back/forward) reuses the stored result instead
	// of calling the model again — ocr_source doubles as this cache and as
	// the "original extraction" audit trail the PRD requires.
	if (medicine.ocr_source) {
		return json(JSON.parse(medicine.ocr_source) as OcrResult);
	}

	const object = await platform!.env.PHOTOS.get(medicine.label_photo_key);
	if (!object) return json({ error: 'no_label_photo' }, { status: 400 });

	const result = await extractFromLabelPhoto(
		platform!.env.AI,
		await object.arrayBuffer(),
		object.httpMetadata?.contentType ?? 'image/jpeg'
	);

	await setOcrSource(db, locals.user.id, medicine.id, JSON.stringify(result));
	return json(result);
};

import { json } from '@sveltejs/kit';
import { getMedicineById, setPhotoKey } from '$lib/server/db/queries/medicines';
import { InvalidPhotoError, labelPhotoKey, putPhoto, readPhotoFromFormData } from '$lib/server/r2';
import { checkAndIncrement } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// Protects R2 storage/write quota against a runaway or scripted uploader.
const UPLOAD_LIMIT = 30;
const UPLOAD_WINDOW_SECONDS = 3600;

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const db = platform!.env.DB;

	const medicine = await getMedicineById(db, locals.user.id, params.id);
	if (!medicine) return json({ error: 'not_found' }, { status: 404 });

	const allowed = await checkAndIncrement(
		platform!.env.OTP_KV,
		`photo_rl:${locals.user.id}`,
		UPLOAD_LIMIT,
		UPLOAD_WINDOW_SECONDS
	);
	if (!allowed) return json({ error: 'rate_limited' }, { status: 429 });

	let file;
	try {
		file = await readPhotoFromFormData(request);
	} catch (err) {
		if (err instanceof InvalidPhotoError) return json({ error: err.message }, { status: 400 });
		throw err;
	}

	const key = labelPhotoKey(locals.user.id, medicine.id);
	await putPhoto(platform!.env.PHOTOS, key, file);
	await setPhotoKey(db, locals.user.id, medicine.id, 'label', key);

	return json({ key });
};

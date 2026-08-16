// Key naming + put/get for the PHOTOS bucket. Keys are namespaced
// `medicines/{userId}/{medicineId}/...` deliberately — GET /api/photos/[...key]
// parses the userId back out of the key itself to authorize a stream, with no
// D1 lookup needed on that hot read path.

export function labelPhotoKey(userId: string, medicineId: string): string {
	return `medicines/${userId}/${medicineId}/label-${Date.now()}.jpg`;
}

export function pillPhotoKey(userId: string, medicineId: string): string {
	return `medicines/${userId}/${medicineId}/pill-${Date.now()}.jpg`;
}

/** True if `key` is namespaced under `userId` — the whole ownership check for GET /api/photos/[...key]. */
export function keyBelongsToUser(key: string, userId: string): boolean {
	return key.startsWith(`medicines/${userId}/`);
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export class InvalidPhotoError extends Error {}

/** Pulls the uploaded file out of a multipart form body, rejecting anything that isn't a reasonably-sized image. */
export async function readPhotoFromFormData(request: Request, field = 'photo'): Promise<File> {
	const form = await request.formData().catch(() => null);
	const file = form?.get(field);
	if (!(file instanceof File) || !file.type.startsWith('image/')) {
		throw new InvalidPhotoError('no_image_uploaded');
	}
	if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
		throw new InvalidPhotoError('image_too_large');
	}
	return file;
}

export async function putPhoto(bucket: R2Bucket, key: string, file: File): Promise<void> {
	await bucket.put(key, await file.arrayBuffer(), {
		httpMetadata: { contentType: file.type }
	});
}

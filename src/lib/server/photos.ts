// Key naming + put/get for the PHOTOS KV namespace. Keys are namespaced
// `medicines/{userId}/{medicineId}/...` deliberately — GET /api/photos/[...key]
// parses the userId back out of the key itself to authorize a stream, with no
// D1 lookup needed on that hot read path.
//
// KV instead of R2: no account-level dashboard enablement needed to
// provision it, and well within KV's free tier (1GB storage, 25MB/value,
// 1,000 writes/day) for a handful of users. Content-Type rides along in KV
// metadata since KV values are opaque bytes.

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

export async function putPhoto(kv: KVNamespace, key: string, file: File): Promise<void> {
	await kv.put(key, await file.arrayBuffer(), {
		metadata: { contentType: file.type }
	});
}

export async function getPhoto(
	kv: KVNamespace,
	key: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
	const { value, metadata } = await kv.getWithMetadata<{ contentType: string }>(key, 'arrayBuffer');
	if (value === null) return null;
	return { body: value, contentType: metadata?.contentType ?? 'application/octet-stream' };
}

/** Account deletion's KV cleanup — D1's ON DELETE CASCADE only ever covers
 *  D1 rows, so without this every photo a deleted user uploaded would be
 *  orphaned in the namespace forever. Best-effort by design: catches and
 *  logs rather than throwing, since blocking account deletion over a
 *  transient storage hiccup is worse than a rare orphaned photo, and
 *  there's no later retry once the D1 row holding the key is gone. */
export async function deleteAllUserPhotos(kv: KVNamespace, userId: string): Promise<void> {
	const prefix = `medicines/${userId}/`;
	try {
		let cursor: string | undefined;
		do {
			const listed = await kv.list({ prefix, cursor });
			await Promise.all(listed.keys.map((k) => kv.delete(k.name)));
			cursor = listed.list_complete ? undefined : listed.cursor;
		} while (cursor);
	} catch (err) {
		console.error(`failed to delete KV photos for user ${userId}: ${err}`);
	}
}

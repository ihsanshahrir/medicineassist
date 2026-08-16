import { error } from '@sveltejs/kit';
import { getPhoto, keyBelongsToUser } from '$lib/server/photos';
import type { RequestHandler } from './$types';

// Streams a private KV value after an auth check. Ownership is checked from
// the key's own `medicines/{userId}/...` prefix (see photos.ts) rather than
// a D1 lookup — this is the hot path for every photo the PWA renders (label
// thumbnail, pill photo), and vite.config.ts caches it CacheFirst client-side
// on top, so it's deliberately cheap.
export const GET: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) error(401, 'unauthorized');
	if (!keyBelongsToUser(params.key, locals.user.id)) error(404, 'not_found');

	const photo = await getPhoto(platform!.env.PHOTOS, params.key);
	if (!photo) error(404, 'not_found');

	return new Response(photo.body, {
		headers: {
			'Content-Type': photo.contentType,
			'Cache-Control': 'private, max-age=2592000, immutable'
		}
	});
};

import { error } from '@sveltejs/kit';
import { keyBelongsToUser } from '$lib/server/r2';
import type { RequestHandler } from './$types';

// Streams a private R2 object after an auth check. Ownership is checked from
// the key's own `medicines/{userId}/...` prefix (see r2.ts) rather than a D1
// lookup — this is the hot path for every photo the PWA renders (label
// thumbnail, pill photo), and vite.config.ts caches it CacheFirst client-side
// on top, so it's deliberately cheap.
export const GET: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) error(401, 'unauthorized');
	if (!keyBelongsToUser(params.key, locals.user.id)) error(404, 'not_found');

	const object = await platform!.env.PHOTOS.get(params.key);
	if (!object) error(404, 'not_found');

	return new Response(object.body, {
		headers: {
			'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
			'Cache-Control': 'private, max-age=2592000, immutable'
		}
	});
};

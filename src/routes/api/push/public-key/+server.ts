import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The VAPID public key is, by design, not secret — it's handed to the
// browser as pushManager.subscribe()'s applicationServerKey. Still gated on
// sign-in since nothing calls this outside the signed-in app shell.
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const key = platform!.env.VAPID_PUBLIC_KEY;
	if (!key) return json({ error: 'push_not_configured' }, { status: 503 });
	return json({ key });
};

import type { Handle } from '@sveltejs/kit';
import { verifySessionCookie } from '$lib/server/auth/session';

// Populates event.locals.user from the session cookie on every request.
// Deliberately does NOT hit D1 here (no user lookup) — the cookie's signed
// payload already carries the verified user id, and route handlers that
// need more than the id can query D1 themselves. Keeps this hook cheap
// against the shared per-request budget.
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	const cookie = event.cookies.get('session');
	const secret = event.platform?.env?.SESSION_SECRET;
	if (cookie && secret) {
		const uid = await verifySessionCookie(secret, cookie);
		if (uid) event.locals.user = { id: uid };
	}

	return resolve(event);
};

import { json, redirect, type Cookies } from '@sveltejs/kit';
import type { SessionUser } from './session';

/** Call at the top of any protected +page.server.ts load. Redirects, never returns null. */
export function requireUser(user: SessionUser | null): SessionUser {
	if (!user) redirect(307, '/sign-in');
	return user;
}

/**
 * For an API route whose session cookie verified but whose user row is gone —
 * the account was deleted (possibly from another tab), or a local D1 was reset
 * / re-migrated. That's a stale session, not a missing resource: clear the
 * cookie and 401 so the client's apiFetch redirects to /sign-in, rather than
 * stranding the page on an error with no signed-in UI left to recover from.
 */
export function staleSession(cookies: Cookies): Response {
	cookies.delete('session', { path: '/' });
	return json({ error: 'unauthorized' }, { status: 401 });
}

import { redirect } from '@sveltejs/kit';
import type { SessionUser } from './session';

/** Call at the top of any protected +page.server.ts load. Redirects, never returns null. */
export function requireUser(user: SessionUser | null): SessionUser {
	if (!user) redirect(307, '/sign-in');
	return user;
}

import { requireUser } from '$lib/server/auth/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals.user);
};

import { requireUser } from '$lib/server/auth/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireUser(locals.user);
	return { id: params.id };
};

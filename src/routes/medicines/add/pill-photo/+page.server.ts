import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireUser(locals.user);
	const id = url.searchParams.get('id');
	if (!id) redirect(307, '/medicines/add');
	return {
		id,
		doseAmount: url.searchParams.get('doseAmount'),
		doseUnit: url.searchParams.get('doseUnit'),
		freq: url.searchParams.get('freq')
	};
};

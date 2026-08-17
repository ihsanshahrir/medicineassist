import type { PageServerLoad } from './$types';

// Public marketing page — no auth guard. Signed-in state only changes the
// hero CTA (see +page.svelte), it never redirects here.
export const load: PageServerLoad = async ({ locals }) => {
	return { signedIn: !!locals.user };
};

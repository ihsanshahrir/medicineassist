import { requireUser } from '$lib/server/auth/guard';
import type { PageServerLoad } from './$types';

// Auth guard only — the page's actual data comes from a client-side fetch
// to GET /api/today (see +page.svelte), not from this load function. That's
// deliberate: Workbox's runtime caching (vite.config.ts) only sees requests
// that hit /api/today as a real path, which SvelteKit's own load/data
// mechanism doesn't produce. This is what makes Today offline-readable.
export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals.user);
};

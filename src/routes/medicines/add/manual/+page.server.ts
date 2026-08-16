import { requireUser } from '$lib/server/auth/guard';
import type { PageServerLoad } from './$types';

// `?id=` is set only when the OCR wizard drops here after a failed read —
// the draft medicine (and its label photo) already exist, so this finishes
// that row out instead of creating a new one. See MedicineForm's 'draft' mode.
export const load: PageServerLoad = async ({ locals, url }) => {
	requireUser(locals.user);
	return { draftId: url.searchParams.get('id') };
};

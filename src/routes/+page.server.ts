import { redirect } from '@sveltejs/kit';

// The app always opens to Today — matches the PWA manifest's start_url and
// the PRD's "the app always opens here" requirement for the home screen.
export function load() {
	redirect(307, '/today');
}

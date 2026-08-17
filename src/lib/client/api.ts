import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

// A 401 here means the session cookie expired or was cleared after the page
// already loaded (the SSR guard in hooks.server.ts/guard.ts only checks at
// navigation time) — every caller should bounce to sign-in the same way the
// server-side guard would, rather than surfacing "unauthorized" as a normal
// load error.
async function handleUnauthorized(): Promise<never> {
	await goto(resolve('/sign-in'));
	throw new Error('unauthorized');
}

// Thin fetch wrapper shared by every page that talks to /api/* client-side
// (required for the PWA's Workbox caching to see these requests — see
// vite.config.ts's runtimeCaching rules, which key off these exact paths).
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...init,
		headers: { 'Content-Type': 'application/json', ...init?.headers }
	});
	if (res.status === 401) return handleUnauthorized();
	const data = (await res.json().catch(() => ({}))) as T & { error?: string };
	if (!res.ok) {
		throw new Error(data.error ?? `Request to ${path} failed (${res.status})`);
	}
	return data;
}

// Separate from apiFetch because multipart uploads must NOT set
// Content-Type themselves — the browser needs to add its own boundary.
export async function uploadPhoto<T>(path: string, file: File): Promise<T> {
	const form = new FormData();
	form.set('photo', file);
	const res = await fetch(path, { method: 'POST', body: form });
	if (res.status === 401) return handleUnauthorized();
	const data = (await res.json().catch(() => ({}))) as T & { error?: string };
	if (!res.ok) {
		throw new Error(data.error ?? `Upload to ${path} failed (${res.status})`);
	}
	return data;
}

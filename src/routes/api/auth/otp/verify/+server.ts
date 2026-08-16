import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { verifyOtp } from '$lib/server/auth/otp';
import { createSessionCookie } from '$lib/server/auth/session';
import { upsertUserByEmail } from '$lib/server/db/queries/users';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const body = (await request.json().catch(() => null)) as {
		email?: unknown;
		code?: unknown;
	} | null;
	const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
	const code = typeof body?.code === 'string' ? body.code.trim() : '';

	if (!email || !code) {
		return json({ error: 'invalid_request' }, { status: 400 });
	}

	const result = await verifyOtp(platform!.env.OTP_KV, email, code);
	if (result !== 'ok') {
		return json({ error: result }, { status: 400 });
	}

	// First successful verify for a new email creates the account — this IS
	// signup, per the PRD's passwordless design (no separate registration step).
	const user = await upsertUserByEmail(platform!.env.DB, email);

	const { value, maxAge } = await createSessionCookie(platform!.env.SESSION_SECRET, user.id);
	cookies.set('session', value, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge
	});

	return json({ ok: true });
};

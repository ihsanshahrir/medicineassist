import { json } from '@sveltejs/kit';
import { requestOtp } from '$lib/server/auth/otp';
import { sendOtpEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

// Deliberately loose — this is a "can we deliver mail here" check, not a
// validator we want silently rejecting real addresses. D1's `users.email`
// column is the actual source of truth for what a valid account looks like.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
	const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

	if (!EMAIL_RE.test(email)) {
		return json({ error: 'invalid_email' }, { status: 400 });
	}

	const kv = platform!.env.OTP_KV;
	const result = await requestOtp(kv, email);
	if (!result.ok) {
		return json({ error: result.reason }, { status: 429 });
	}

	await sendOtpEmail(platform!.env, email, result.code);
	return json({ ok: true });
};

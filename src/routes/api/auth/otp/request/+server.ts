import { json } from '@sveltejs/kit';
import { requestOtp } from '$lib/server/auth/otp';
import { sendOtpEmail } from '$lib/server/email';
import { checkAndIncrement } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// Deliberately loose — this is a "can we deliver mail here" check, not a
// validator we want silently rejecting real addresses. D1's `users.email`
// column is the actual source of truth for what a valid account looks like.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Coarser than the per-email limit in requestOtp() — this exists only to
// stop one attacker rotating through many emails from being otherwise
// unconstrained (the per-email limit alone can't see that pattern).
const IP_REQUEST_LIMIT = 20;
const IP_REQUEST_WINDOW_SECONDS = 3600;

export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
	const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
	const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

	if (!EMAIL_RE.test(email)) {
		return json({ error: 'invalid_email' }, { status: 400 });
	}

	const kv = platform!.env.OTP_KV;

	const ipAllowed = await checkAndIncrement(
		kv,
		`otp_rl_ip:${getClientAddress()}`,
		IP_REQUEST_LIMIT,
		IP_REQUEST_WINDOW_SECONDS
	);
	if (!ipAllowed) return json({ error: 'rate_limited' }, { status: 429 });

	const result = await requestOtp(kv, email);
	if (!result.ok) {
		return json({ error: result.reason }, { status: 429 });
	}

	await sendOtpEmail(platform!.env, email, result.code);
	return json({ ok: true });
};

// OTP codes live in KV, not D1 (per the plan). Two independent limits:
// - request rate limit (how many codes can be requested per email per hour)
// - verify attempt limit (how many guesses per issued code before it's
//   burned) — this, not a constant-time string compare, is what actually
//   defends a 6-digit code against brute force.
import { checkAndIncrement } from '../rateLimit';

const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_SECONDS = 3600;

interface OtpRecord {
	code: string;
	attempts: number;
}

function generateCode(): string {
	// crypto.getRandomValues, not Math.random — this gates account access.
	const [n] = crypto.getRandomValues(new Uint32Array(1));
	return (n % 1_000_000).toString().padStart(6, '0');
}

export type RequestOtpResult = { ok: true; code: string } | { ok: false; reason: 'rate_limited' };

export async function requestOtp(kv: KVNamespace, email: string): Promise<RequestOtpResult> {
	const allowed = await checkAndIncrement(
		kv,
		`otp_rl:${email}`,
		REQUEST_LIMIT,
		REQUEST_WINDOW_SECONDS
	);
	if (!allowed) return { ok: false, reason: 'rate_limited' };

	const code = generateCode();
	const record: OtpRecord = { code, attempts: 0 };
	await kv.put(`otp:${email}`, JSON.stringify(record), { expirationTtl: OTP_TTL_SECONDS });
	return { ok: true, code };
}

export type VerifyOtpResult = 'ok' | 'invalid' | 'expired' | 'too_many_attempts';

export async function verifyOtp(
	kv: KVNamespace,
	email: string,
	submitted: string
): Promise<VerifyOtpResult> {
	const key = `otp:${email}`;
	const raw = await kv.get(key);
	if (!raw) return 'expired';

	const record: OtpRecord = JSON.parse(raw);
	if (record.attempts >= OTP_MAX_ATTEMPTS) {
		await kv.delete(key);
		return 'too_many_attempts';
	}

	if (record.code !== submitted) {
		record.attempts += 1;
		await kv.put(key, JSON.stringify(record), { expirationTtl: OTP_TTL_SECONDS });
		return 'invalid';
	}

	await kv.delete(key);
	return 'ok';
}

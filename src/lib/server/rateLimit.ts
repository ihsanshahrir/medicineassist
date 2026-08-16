// Shared increment-with-TTL counter, the same pattern otp.ts originated for
// its request-rate limit. One KV namespace (OTP_KV), many independent keys —
// no new binding needed per caller.

export async function checkAndIncrement(
	kv: KVNamespace,
	key: string,
	limit: number,
	windowSeconds: number
): Promise<boolean> {
	const count = Number((await kv.get(key)) ?? '0');
	if (count >= limit) return false;
	await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
	return true;
}

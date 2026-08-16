// Stateless HMAC-signed session cookie — no sessions table in D1. Per the
// plan: avoids a D1 read on every request against the shared 5M-rows/day
// budget. Signature verification uses crypto.subtle.verify, which is
// timing-safe by construction (never a manual byte-compare).

export interface SessionUser {
	id: string;
}

interface SessionPayload {
	uid: string;
	exp: number; // unix seconds
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

function toBase64Url(bytes: ArrayBuffer): string {
	let binary = '';
	for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
	const padded = str
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(str.length / 4) * 4, '=');
	const binary = atob(padded);
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Returns the cookie value to set, and the maxAge (seconds) to set it with. */
export async function createSessionCookie(
	secret: string,
	userId: string
): Promise<{ value: string; maxAge: number }> {
	const payload: SessionPayload = {
		uid: userId,
		exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
	};
	const payloadB64 = toBase64Url(
		new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer
	);
	const key = await hmacKey(secret);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
	return { value: `${payloadB64}.${toBase64Url(signature)}`, maxAge: SESSION_TTL_SECONDS };
}

/** Returns the verified user id, or null if the cookie is missing/tampered/expired. */
export async function verifySessionCookie(
	secret: string,
	cookieValue: string
): Promise<string | null> {
	const parts = cookieValue.split('.');
	if (parts.length !== 2) return null;
	const [payloadB64, signatureB64] = parts;

	const key = await hmacKey(secret);
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		fromBase64Url(signatureB64) as BufferSource,
		new TextEncoder().encode(payloadB64)
	);
	if (!valid) return null;

	try {
		const payload: SessionPayload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
		if (payload.exp < Math.floor(Date.now() / 1000)) return null;
		return payload.uid;
	} catch {
		return null;
	}
}

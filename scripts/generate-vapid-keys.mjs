// One-time (or per-environment) VAPID keypair generation for the M4
// reminder pipeline. Run: node scripts/generate-vapid-keys.mjs
//
// Prints three values:
//   VAPID_PUBLIC_KEY  -> root app secret (wrangler secret put, from repo root)
//                        AND handed to the browser as pushManager.subscribe()'s
//                        applicationServerKey (see GET /api/push/public-key)
//   VAPID_PRIVATE_JWK -> workers/reminder-engine secret ONLY (wrangler secret
//                        put, run from workers/reminder-engine/) — this is
//                        the one that signs pushes, never expose it to the
//                        browser or store it in the root app
//   VAPID_SUBJECT     -> not generated, just a reminder to set one
//                        (mailto: or https: contact for push-service abuse reports)
//
// For local dev, paste these into .dev.vars (root, VAPID_PUBLIC_KEY only)
// and workers/reminder-engine/.dev.vars (VAPID_PRIVATE_JWK + VAPID_SUBJECT)
// — both files are gitignored.
import { webcrypto } from 'node:crypto';

function base64url(bytes) {
	return Buffer.from(bytes).toString('base64url');
}

const keyPair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
	'sign',
	'verify'
]);

const privateJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);
const publicRaw = await webcrypto.subtle.exportKey('raw', keyPair.publicKey);

console.log('VAPID_PUBLIC_KEY (root app secret + browser applicationServerKey):');
console.log(base64url(publicRaw));
console.log();
console.log('VAPID_PRIVATE_JWK (workers/reminder-engine secret ONLY):');
console.log(JSON.stringify(privateJwk));
console.log();
console.log('VAPID_SUBJECT — not generated, set your own, e.g.: mailto:you@example.com');

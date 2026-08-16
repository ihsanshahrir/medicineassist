// `wrangler types` (worker-configuration.d.ts, run from this directory) only
// covers bindings declared in wrangler.jsonc — secrets are set separately
// (`wrangler secret put`, run from this directory too — this worker has its
// own secret store, distinct from the root app's even though they share a
// D1 database) and so need declaring by hand here. See db/README.md.
export {};

declare global {
	interface Env {
		/** The signing half of the VAPID keypair — see scripts/generate-vapid-keys.mjs.
		 *  The public half lives in the ROOT app's secrets (VAPID_PUBLIC_KEY),
		 *  not here — that's what's handed to the browser to subscribe with. */
		VAPID_PRIVATE_JWK: string;
		/** mailto: or https: contact a push service can use for abuse reports — required by the VAPID spec. */
		VAPID_SUBJECT: string;
	}
}

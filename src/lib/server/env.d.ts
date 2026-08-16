// `wrangler types` (worker-configuration.d.ts) only generates types for
// bindings declared in wrangler.jsonc — real secrets (set via `wrangler
// secret put` in prod, `.dev.vars` locally) are deliberately never declared
// there, so they need declaring by hand here via interface merging onto the
// same global `Env` interface.
export {};

declare global {
	interface Env {
		SESSION_SECRET: string;
		/** Unset in local dev is fine — see src/lib/server/email.ts's fallback. */
		RESEND_API_KEY?: string;
	}
}

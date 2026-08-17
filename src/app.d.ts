/// <reference types="vite-plugin-pwa/client" />
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '$lib/server/auth/session';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		interface Locals {
			/** Set by src/hooks.server.ts from the session cookie. Absent = not signed in. */
			user: SessionUser | null;
		}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};

/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// vite-plugin-pwa's injectManifest source (see vite.config.ts) — this is
// intentionally NOT src/service-worker.ts, SvelteKit's own reserved
// filename for its unrelated native service-worker feature. Runs in the
// ServiceWorkerGlobalScope, not the app's normal DOM/window scope, hence the
// triple-slash directives above swapping this one file's global lib set.
//
// Owns two jobs vite-plugin-pwa's generateSW mode can't: the runtime caching
// rules moved here from the old workbox.runtimeCaching config, and the
// push/notificationclick listeners the M4 reminder pipeline actually needs
// (see workers/reminder-engine — that worker sends the push, this is what
// receives and displays it).
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Offline-readable per the PRD: today's schedule + medicine data + photos.
// Never cache auth, mutations, or push registration — pretending those work
// offline is worse than the honest "you're offline" state.
registerRoute(
	({ url }) => /\/api\/(today|medicines)/.test(url.pathname),
	new NetworkFirst({ cacheName: 'medsassist-data', networkTimeoutSeconds: 4 })
);
registerRoute(
	({ url }) => /\/api\/photos\//.test(url.pathname),
	new CacheFirst({
		cacheName: 'medsassist-photos',
		plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })]
	})
);
registerRoute(({ url }) => /\/api\/(auth|dose-logs|push)\//.test(url.pathname), new NetworkOnly());

interface DosePushPayload {
	title: string;
	body?: string;
	tag?: string;
	url?: string;
}

self.addEventListener('push', (event: PushEvent) => {
	let data: DosePushPayload;
	try {
		data = event.data?.json() as DosePushPayload;
	} catch {
		return;
	}
	if (!data?.title) return;

	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			tag: data.tag,
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			data: { url: data.url ?? '/today' }
		})
	);
});

// Focuses an already-open MedsAssist tab instead of stacking a new one, per
// the PWA's single-purpose "one app, one job" shape.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
	event.notification.close();
	const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/today';

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if ('focus' in client && new URL(client.url).pathname === url) return client.focus();
			}
			return self.clients.openWindow(url);
		})
	);
});

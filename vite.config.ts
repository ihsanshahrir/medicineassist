import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		}),
		VitePWA({
			registerType: 'autoUpdate',
			// injectManifest (not generateSW) since M4 needs a hand-written 'push'
			// event listener to actually display reminders — generateSW's
			// Workbox-authored service worker has no hook for custom event
			// listeners, only caching recipes. src/service-worker.ts owns both the
			// caching rules (moved there from workbox.runtimeCaching below) and the
			// push/notificationclick handlers.
			strategies: 'injectManifest',
			srcDir: 'src',
			// Deliberately NOT `service-worker.ts` — that exact filename is
			// SvelteKit's own reserved convention (kit.files.serviceWorker) for its
			// unrelated native service-worker feature, and having both present
			// would fight over registering/serving a service worker.
			filename: 'sw.ts',
			includeAssets: ['pictograms.svg'],
			manifest: {
				name: 'MedsAssist',
				short_name: 'MedsAssist',
				description: 'What to take, right now — with a photo of the actual pill.',
				start_url: '/today',
				scope: '/',
				display: 'standalone',
				background_color: '#FAF9F6', // --ground
				theme_color: '#0F5D4E', // --sage-700
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/icons/icon-512-maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			injectManifest: {
				// Default globPatterns also match static/pictograms.svg and the icon
				// PNGs, which is what we want precached alongside the JS/CSS bundle.
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
			}
		})
	]
});

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
			strategies: 'generateSW',
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
			workbox: {
				// Offline-readable per the PRD: today's schedule + medicine data + photos.
				// Never cache auth, mutations, or push registration — pretending those
				// work offline is worse than the honest "you're offline" state.
				runtimeCaching: [
					{
						urlPattern: /\/api\/(today|medicines)/,
						handler: 'NetworkFirst',
						options: { cacheName: 'medsassist-data', networkTimeoutSeconds: 4 }
					},
					{
						urlPattern: /\/api\/photos\//,
						handler: 'CacheFirst',
						options: {
							cacheName: 'medsassist-photos',
							expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
						}
					},
					{
						urlPattern: /\/api\/(auth|dose-logs|push)\//,
						handler: 'NetworkOnly'
					}
				]
			}
		})
	]
});

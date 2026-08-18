// Pure platform/capability detection for the install-to-Home-Screen flow.
// No state and no reactivity — every function reads the live environment at
// call time. installPrompt.svelte.ts is the only place that caches a result.

export type InstallPlatform = 'ios-safari' | 'ios-browser' | 'manual-menu' | 'unavailable';

// 'minimal-ui' and 'window-controls-overlay' matter as much as 'standalone':
// an installed app can launch into any of them depending on the manifest and
// the platform, and treating those as "not installed" is what made
// push.ts and the marketing page disagree before they shared this helper.
const STANDALONE_QUERIES = [
	'(display-mode: standalone)',
	'(display-mode: fullscreen)',
	'(display-mode: minimal-ui)',
	'(display-mode: window-controls-overlay)'
];

/** True when this window IS the installed app. Says nothing about whether the
 *  app is installed somewhere else — no browser API can tell us that. */
export function isStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		STANDALONE_QUERIES.some((q) => window.matchMedia(q).matches) ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

// iPadOS 13+ reports a desktop Safari user agent ("Macintosh"), and
// navigator.platform is deprecated — maxTouchPoints is the remaining way to
// tell an iPad from a Mac.
function isIos(ua: string): boolean {
	return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Embedded webviews (Facebook, Instagram, Line, Android WebView) can't install
// anything, and showing instructions there sends people down a dead end.
function isInAppWebview(ua: string): boolean {
	return /FBAN|FBAV|Instagram|Line\/|; wv\)/.test(ua);
}

/**
 * The fallback path, used only when no `beforeinstallprompt` event was
 * captured. Deliberately never returns a "one tap works here" answer — that
 * claim belongs to the event alone, never to a user-agent string.
 */
export function detectInstallPlatform(): InstallPlatform {
	if (typeof window === 'undefined') return 'unavailable';
	const ua = navigator.userAgent;

	if (isInAppWebview(ua)) return 'unavailable';

	if (isIos(ua)) {
		// Every iOS browser is Safari underneath, but only Safari itself has
		// "Add to Home Screen" in its share sheet; the others hide it in their
		// own menu, and on some it is missing entirely.
		return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-browser' : 'ios-safari';
	}

	// Android browsers that support installing but never fire
	// beforeinstallprompt — the user has to go through the browser menu.
	if (/Android/.test(ua) && /Firefox\/|SamsungBrowser/.test(ua)) return 'manual-menu';

	// Desktop Safari/Firefox, and any Chromium that hasn't fired the event.
	return 'unavailable';
}

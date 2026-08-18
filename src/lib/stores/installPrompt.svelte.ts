// Shared client state (Svelte 5 module pattern) for "add MedsAssist to your
// Home Screen" — the landing-page CTA, the in-app banner and the Settings
// button all read this one store, so they can never disagree about whether
// the app is already installed.
//
// Installing matters more here than for a typical PWA: on iOS, Web Push only
// works from an installed icon, so an uninstalled iPhone user gets no
// reminders at all (docs/PRD.md line 106).
import { detectInstallPlatform, isStandalone } from '$lib/client/platform';

export type InstallState =
	| 'unknown'
	| 'installed'
	| 'prompt-ready'
	| 'ios-safari'
	| 'ios-browser'
	| 'manual-menu'
	| 'unavailable';

export type InstallOutcome = 'accepted' | 'dismissed' | 'needs-instructions' | 'unavailable';

// The subset of BeforeInstallPromptEvent we use. It isn't in lib.dom.d.ts
// because it has never been part of any spec — Chromium-only.
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_AT_KEY = 'medsassist.install.dismissedAt';
const DISMISS_COUNT_KEY = 'medsassist.install.dismissCount';

// Escalating snooze rather than "persistent until installed" (PRD line 106
// read literally): a banner that can never be silenced is a dark pattern for
// this audience. Permanent dismissal stays safe because Settings keeps a
// permanent install button.
const SNOOZE_MS = [7 * 24 * 60 * 60 * 1000, 30 * 24 * 60 * 60 * 1000];

export const install = $state<{ state: InstallState; bannerSuppressed: boolean }>({
	state: 'unknown',
	bannerSuppressed: false
});

// Held outside the $state object: this is a live DOM event, not reactive data,
// and it is single-use — Chromium will not hand us another until a fresh
// navigation.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;

// localStorage is the codebase's only client-side persistence, deliberately:
// the landing page is unauthenticated so a server flag can't work there at
// all, and "did I install this app" is a fact about THIS browser on THIS
// device, not about the account — a server flag would wrongly silence the
// banner on the user's second device. Safari private mode throws on write.
function readStorage(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Private mode or storage disabled — the banner just reappears next
		// visit, which is a far better failure than crashing the layout.
	}
}

function clearDismissal(): void {
	try {
		localStorage.removeItem(DISMISSED_AT_KEY);
		localStorage.removeItem(DISMISS_COUNT_KEY);
	} catch {
		// See writeStorage.
	}
}

function isBannerSuppressed(): boolean {
	const count = Number(readStorage(DISMISS_COUNT_KEY) ?? '0');
	if (count <= 0) return false;
	if (count > SNOOZE_MS.length) return true; // dismissed three times — done asking

	const dismissedAt = Number(readStorage(DISMISSED_AT_KEY) ?? '0');
	return Date.now() - dismissedAt < SNOOZE_MS[count - 1];
}

function refreshState(): void {
	if (isStandalone()) {
		install.state = 'installed';
		return;
	}
	install.state = deferredPrompt ? 'prompt-ready' : detectInstallPlatform();
}

/** True when any install UI should render at all. */
export function canOfferInstall(): boolean {
	return (
		install.state !== 'unknown' && install.state !== 'installed' && install.state !== 'unavailable'
	);
}

/**
 * Idempotent; call from the root layout's onMount. Returns a teardown fn.
 *
 * Adopts whatever the inline capture script in src/app.html already stashed —
 * `beforeinstallprompt` fires once per page load and can land before this
 * bundle has even parsed, and a missed event is unrecoverable.
 */
export function initInstallPrompt(): () => void {
	if (initialized) return () => {};
	initialized = true;

	deferredPrompt = (window.__maInstallEvent as BeforeInstallPromptEvent | null) ?? null;
	if (window.__maInstalled) install.state = 'installed';

	install.bannerSuppressed = isBannerSuppressed();
	refreshState();

	const onBeforeInstallPrompt = (e: Event) => {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
		refreshState();
	};

	const onAppInstalled = () => {
		deferredPrompt = null;
		window.__maInstallEvent = null;
		// An uninstall/reinstall cycle should start from a clean slate.
		clearDismissal();
		install.bannerSuppressed = false;
		install.state = 'installed';
	};

	// Covers the case where the app is installed in another tab, or the window
	// transitions into standalone without a reload.
	const displayModeQuery = window.matchMedia('(display-mode: standalone)');
	const onDisplayModeChange = () => refreshState();

	window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
	window.addEventListener('appinstalled', onAppInstalled);
	displayModeQuery.addEventListener('change', onDisplayModeChange);

	return () => {
		window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
		window.removeEventListener('appinstalled', onAppInstalled);
		displayModeQuery.removeEventListener('change', onDisplayModeChange);
		initialized = false;
	};
}

/**
 * MUST be called synchronously from inside a click handler — Chromium rejects
 * prompt() without a user gesture. 'needs-instructions' means the caller
 * should open InstallSheet instead.
 */
export async function requestInstall(): Promise<InstallOutcome> {
	if (install.state === 'ios-safari' || install.state === 'ios-browser') {
		return 'needs-instructions';
	}
	if (install.state === 'manual-menu') return 'needs-instructions';
	if (!deferredPrompt) return 'unavailable';

	const event = deferredPrompt;
	// Null it before awaiting: the event is single-use either way, and this
	// stops a double-tap from calling prompt() twice on the same event.
	deferredPrompt = null;
	window.__maInstallEvent = null;

	await event.prompt();
	const { outcome } = await event.userChoice;

	if (outcome === 'dismissed') {
		// Declining the OS dialog is a real "no". Without this the button
		// would still be on screen but silently do nothing on the next tap.
		install.state = 'unavailable';
		suppressInstallBanner();
		return 'dismissed';
	}

	// 'accepted' is followed by the appinstalled event, which sets
	// state = 'installed' and clears the dismissal keys.
	return 'accepted';
}

/** The in-app banner's dismiss control. */
export function suppressInstallBanner(): void {
	const count = Number(readStorage(DISMISS_COUNT_KEY) ?? '0') + 1;
	writeStorage(DISMISS_COUNT_KEY, String(count));
	writeStorage(DISMISSED_AT_KEY, String(Date.now()));
	install.bannerSuppressed = true;
}

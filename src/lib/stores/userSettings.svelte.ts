// Shared client state (Svelte 5 module pattern) for the two Settings
// preferences that need to affect the WHOLE app shell, not just the
// Settings screen itself: text size (+layout.svelte mirrors this onto
// <html data-text-size>, which app.css's overrides key off) and language
// (read by instructionTags.ts consumers to pick .en vs .ms labels).
// Populated once, from +layout.svelte's onMount — silently stays at
// defaults if the fetch 401s (signed out) or fails (offline).
export const userSettings = $state<{
	language: 'en' | 'ms';
	textSize: 'normal' | 'large' | 'xl';
}>({
	language: 'en',
	textSize: 'normal'
});

export async function loadUserSettings(): Promise<void> {
	try {
		const res = await fetch('/api/me');
		if (!res.ok) return;
		const data = (await res.json()) as { language?: string; textSize?: string };
		if (data.language === 'en' || data.language === 'ms') userSettings.language = data.language;
		if (data.textSize === 'normal' || data.textSize === 'large' || data.textSize === 'xl') {
			userSettings.textSize = data.textSize;
		}
	} catch {
		// Offline or signed out — defaults are a fine fallback either way.
	}
}

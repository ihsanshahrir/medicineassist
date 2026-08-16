// Client-side display formatting only — deliberately uses the BROWSER's own
// timezone (not a server-computed tz_offset_minutes) since v1 is Malaysia/SEA
// only and a user's device is realistically already set to Asia/Kuala_Lumpur.
// Keeps the client dumb: no need to thread tz_offset_minutes through to it.

export function formatTimeLabel(iso: string): string {
	return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export type AnchorLabel = 'morning' | 'afternoon' | 'evening' | 'night';

export function anchorFromIso(iso: string): AnchorLabel {
	const h = new Date(iso).getHours();
	if (h >= 5 && h < 12) return 'morning';
	if (h >= 12 && h < 17) return 'afternoon';
	if (h >= 17 && h < 21) return 'evening';
	return 'night';
}

const ANCHOR_TEXT: Record<AnchorLabel, string> = {
	morning: 'Morning',
	afternoon: 'Afternoon',
	evening: 'Evening',
	night: 'Night'
};

export function anchorText(anchor: AnchorLabel): string {
	return ANCHOR_TEXT[anchor];
}

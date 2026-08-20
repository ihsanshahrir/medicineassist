// Display formatting for dose times.
//
// Times are stored as ISO UTC and computed server-side against the user's
// stored tz_offset_minutes, so a label must be rendered against that SAME
// offset — not the browser's timezone. Rendering with the device timezone made
// every Today label disagree with the schedule the user had entered whenever
// the device was not on +08:00, which reads as a wrong-time bug in its own
// right. `tzOffsetMinutes` is therefore required wherever a schedule time is
// shown; omitting it falls back to the browser for incidental timestamps
// (e.g. Settings' "last delivered") that have no schedule to agree with.

/** Wall-clock parts of `iso` as seen at a fixed UTC offset. */
function partsAtOffset(iso: string, tzOffsetMinutes: number): Date {
	return new Date(new Date(iso).getTime() + tzOffsetMinutes * 60_000);
}

export function formatTimeLabel(iso: string, tzOffsetMinutes?: number): string {
	if (tzOffsetMinutes === undefined) {
		return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}
	// Read the shifted instant in UTC so the host timezone cannot leak in.
	return partsAtOffset(iso, tzOffsetMinutes).toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC'
	});
}

export type AnchorLabel = 'morning' | 'afternoon' | 'evening' | 'night';

export function anchorFromIso(iso: string, tzOffsetMinutes?: number): AnchorLabel {
	const h =
		tzOffsetMinutes === undefined
			? new Date(iso).getHours()
			: partsAtOffset(iso, tzOffsetMinutes).getUTCHours();
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

/** The schedule_times.anchor_label the API returns is free text; fall back to
 *  deriving one from the clock when it is null or not a known anchor. */
export function resolveAnchor(
	anchorLabel: string | null,
	iso: string,
	tzOffsetMinutes?: number
): AnchorLabel {
	if (anchorLabel && anchorLabel in ANCHOR_TEXT) return anchorLabel as AnchorLabel;
	return anchorFromIso(iso, tzOffsetMinutes);
}

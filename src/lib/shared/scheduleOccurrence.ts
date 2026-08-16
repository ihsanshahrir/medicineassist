// Pure date/schedule math — no DB, no platform APIs. Shared by the web app's
// GET /api/today (computes occurrences on read, no cron yet) and, later,
// workers/reminder-engine's cron scan (M4) — both need identical "is this
// schedule due on this local date" logic, so it lives in one place.
//
// v1 is fixed to a single offset (MYT, +480 min, no DST) per the PRD's
// Malaysia/SEA-only scope — see db/migrations/0001_init.sql's note on
// users.tz_offset_minutes. That's what makes the arithmetic below exact
// rather than approximate: no DST transition can ever fall inside it.

export interface ScheduleLike {
	repeatType: 'daily' | 'every_n_days' | 'weekdays';
	repeatIntervalDays: number | null;
	weekdaysMask: number | null; // bit0=Mon..bit6=Sun
	startDate: string; // YYYY-MM-DD, local
	endDate: string | null; // YYYY-MM-DD, local
}

function parseDateOnly(dateStr: string): number {
	const [y, m, d] = dateStr.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

// Exported for the medicine detail page's course-completion progress ("Day 3
// of 7") — a plain YYYY-MM-DD diff, no timezone math needed beyond what the
// date strings themselves already encode.
export function daysBetween(fromDateStr: string, toDateStr: string): number {
	const MS_PER_DAY = 86_400_000;
	return Math.round((parseDateOnly(toDateStr) - parseDateOnly(fromDateStr)) / MS_PER_DAY);
}

/** 0=Monday .. 6=Sunday, matching schedules.weekdays_mask's bit order. */
function mondayBitForDate(dateStr: string): number {
	const jsDay = new Date(parseDateOnly(dateStr)).getUTCDay(); // 0=Sun..6=Sat
	return (jsDay + 6) % 7;
}

export interface DoseFrequencyLike {
	doseAmount: number;
	timesPerDay: number;
	repeatType: 'daily' | 'every_n_days' | 'weekdays';
	repeatIntervalDays: number | null;
	weekdaysMask: number | null;
}

/** Average daily dose implied by a schedule's recurrence pattern — used both
 *  for the Today "days remaining" display and M5's event-driven 7d/2d supply
 *  alerts (src/lib/server/push/supplyAlerts.ts), which need the identical
 *  number so a UI estimate and an actual alert never disagree. */
export function estimateAvgDailyDose(schedule: DoseFrequencyLike): number {
	const perOccurrence = schedule.doseAmount * schedule.timesPerDay;
	if (schedule.repeatType === 'every_n_days') {
		return perOccurrence / (schedule.repeatIntervalDays || 1);
	}
	if (schedule.repeatType === 'weekdays') {
		const mask = schedule.weekdaysMask ?? 0;
		let activeDays = 0;
		for (let bit = 0; bit < 7; bit++) if ((mask >> bit) & 1) activeDays++;
		return perOccurrence * (activeDays / 7);
	}
	return perOccurrence; // daily
}

export function isScheduledOnLocalDate(schedule: ScheduleLike, localDateStr: string): boolean {
	if (localDateStr < schedule.startDate) return false;
	if (schedule.endDate && localDateStr > schedule.endDate) return false;

	switch (schedule.repeatType) {
		case 'daily':
			return true;
		case 'every_n_days': {
			const interval = schedule.repeatIntervalDays ?? 1;
			if (interval <= 0) return false;
			return daysBetween(schedule.startDate, localDateStr) % interval === 0;
		}
		case 'weekdays': {
			const bit = mondayBitForDate(localDateStr);
			return ((schedule.weekdaysMask ?? 0) >> bit) % 2 === 1;
		}
		default:
			return false;
	}
}

/** The user's current local calendar date, as YYYY-MM-DD. */
export function todayLocalDateStr(tzOffsetMinutes: number): string {
	const shifted = new Date(Date.now() + tzOffsetMinutes * 60_000);
	return shifted.toISOString().slice(0, 10);
}

/** Bare 'HH:MM' + offset -> 'HH:MM' UTC, no date component — used for both
 *  schedule_times.time_utc and users.quiet_hours_*_utc, which are daily
 *  recurring times rather than instants (so they don't need a calendar date
 *  the way scheduled_at does). */
export function timeLocalToUtc(timeLocal: string, tzOffsetMinutes: number): string {
	const [hh, mm] = timeLocal.split(':').map(Number);
	const totalMinutes = (hh * 60 + mm - tzOffsetMinutes + 1440 * 2) % 1440;
	return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

/**
 * Combines a local calendar date + local wall-clock time + the user's fixed
 * offset into the true UTC instant — this is what scheduled_at is stored as.
 * Deliberately doesn't use schedule_times.time_utc (that field exists for
 * the cron's cross-user indexed lookup, a different access pattern) — this
 * is simpler and avoids that field's own date-rollover ambiguity.
 */
export function localDateTimeToUtcIso(
	localDateStr: string,
	timeLocal: string,
	tzOffsetMinutes: number
): string {
	const [y, m, d] = localDateStr.split('-').map(Number);
	const [hh, mm] = timeLocal.split(':').map(Number);
	const utcMillis = Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMinutes * 60_000;
	return new Date(utcMillis).toISOString();
}

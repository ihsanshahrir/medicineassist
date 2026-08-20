// Single source of truth for "what state is this dose in, right now".
//
// dose_logs has 5 persisted statuses, but the UI needs 7 display states: a
// 'pending' row means something different before its scheduled time
// (upcoming), just after it (due), well after it (overdue), and long after it
// (missed). Deriving those three from status + scheduled_at + the clock keeps
// the DB schema at 5 statuses — no migration, no extra sweep writes, and no
// risk of the cron and the on-read path disagreeing about a 6th value.
//
// Pure functions only — no DB, no platform APIs — so the same module is shared
// by GET /api/today, the Today page's local ticking clock, and
// workers/reminder-engine's cron, exactly like scheduleOccurrence.ts.

import type { DoseLogStatus } from './types';

export const MISSED_AFTER_MS = 3 * 60 * 60 * 1000;
export const DUE_WINDOW_MS = 30 * 60 * 1000; // how long a dose reads as "now" before it reads as late
export const SNOOZE_MINUTES = 15;
export const SNOOZE_MAX = 2;
export const UNDO_GRACE_MS = 30_000; // generous vs the PRD's 10s UI affordance, to absorb request latency

export type DoseDisplayState =
	'upcoming' | 'due' | 'overdue' | 'snoozed' | 'taken' | 'skipped' | 'missed';

export interface DoseStateInput {
	status: DoseLogStatus;
	scheduledAt: string; // ISO UTC
	snoozedUntil?: string | null; // ISO UTC
}

export interface DerivedDoseState {
	state: DoseDisplayState;
	/** How far past `scheduledAt` we are, clamped at 0. Only meaningful for due/overdue/missed. */
	lateByMs: number;
	/** When a live snooze comes back, else null. */
	returnsAtMs: number | null;
}

export function deriveDoseState(o: DoseStateInput, nowMs: number): DerivedDoseState {
	const scheduledMs = new Date(o.scheduledAt).getTime();
	const lateByMs = Math.max(0, nowMs - scheduledMs);

	if (o.status === 'taken' || o.status === 'skipped' || o.status === 'missed') {
		return { state: o.status, lateByMs, returnsAtMs: null };
	}

	if (o.status === 'snoozed' && o.snoozedUntil) {
		const returnsAtMs = new Date(o.snoozedUntil).getTime();
		if (returnsAtMs > nowMs) return { state: 'snoozed', lateByMs, returnsAtMs };
		// An elapsed snooze deliberately falls through to the pending rules below.
		// The DB wake-up query flips it back to 'pending', but that only runs on a
		// cron tick or a Today load — deriving it here is what makes a woken snooze
		// reappear in the Now card immediately, without waiting on a round trip.
	}

	if (nowMs < scheduledMs) return { state: 'upcoming', lateByMs: 0, returnsAtMs: null };
	if (lateByMs < DUE_WINDOW_MS) return { state: 'due', lateByMs, returnsAtMs: null };
	if (lateByMs < MISSED_AFTER_MS) return { state: 'overdue', lateByMs, returnsAtMs: null };
	// Derived rather than read from the row: the sweep may not have run yet, and
	// the client's local clock has no way to run it at all. Keeping the UI
	// self-consistent between ticks matters more than mirroring the row exactly.
	return { state: 'missed', lateByMs, returnsAtMs: null };
}

/** States that belong in the actionable Now card (as opposed to the timeline). */
export function isActionableNow(state: DoseDisplayState): boolean {
	return state === 'due' || state === 'overdue';
}

/** States the user has not resolved one way or the other. */
export function isUnresolved(state: DoseDisplayState): boolean {
	return state !== 'taken' && state !== 'skipped';
}

/** "45 minutes late" / "3 hours late" — plain words, no alarm language (DESIGN.md rule 2). */
export function formatLateBy(lateByMs: number): string {
	const minutes = Math.floor(lateByMs / 60_000);
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} late`;
	const hours = Math.floor(minutes / 60);
	const rem = minutes % 60;
	if (rem === 0) return `${hours} hour${hours === 1 ? '' : 's'} late`;
	return `${hours} hr ${rem} min late`;
}

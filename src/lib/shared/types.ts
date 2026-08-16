// Shared DTOs — mirrors db/migrations/0001_init.sql. Kept as plain types (no
// class/ORM) since both the web app and workers/reminder-engine read the same
// D1 rows via hand-written queries per the plan.

export type MedicineForm = 'tablet' | 'capsule' | 'syrup' | 'inhaler' | 'drops' | 'other';
export type DoseUnit = 'tablet' | 'capsule' | 'half_tablet' | 'ml' | 'puff' | 'drop';
export type RepeatType = 'daily' | 'every_n_days' | 'weekdays';
export type DoseLogStatus = 'pending' | 'taken' | 'skipped' | 'snoozed' | 'missed';

// Matches the 10 instruction/warning pic-* symbols in design/pictograms.svg —
// see src/lib/shared/instructionTags.ts for the id mapping.
export type InstructionTag =
	'with_food' | 'before_food' | 'empty_stomach' | 'swallow_whole' | 'do_not_crush' | 'shake_first';
export type WarningTag = 'drowsiness' | 'no_alcohol' | 'do_not_drive' | 'keep_refrigerated';

export interface Medicine {
	id: string;
	userId: string;
	name: string;
	strength: string | null;
	form: MedicineForm;
	whatFor: string | null;
	instructionsText: string | null;
	instructionTags: InstructionTag[];
	warningTags: WarningTag[];
	notes: string | null;
	accentIndex: number; // 1-8, see design/colors_and_type.css --accent-*
	pillPhotoKey: string | null;
	labelPhotoKey: string | null;
	supplyCount: number | null;
	lastRefillAt: string | null;
	isDraft: boolean;
	isArchived: boolean;
}

export interface Schedule {
	id: string;
	medicineId: string;
	doseAmount: number;
	doseUnit: DoseUnit;
	repeatType: RepeatType;
	repeatIntervalDays: number | null;
	weekdaysMask: number | null; // bit0=Mon..bit6=Sun
	startDate: string; // YYYY-MM-DD
	endDate: string | null;
	times: ScheduleTime[];
}

export interface ScheduleTime {
	id: string;
	timeLocal: string; // HH:MM
	timeUtc: string; // HH:MM
	anchorLabel: 'morning' | 'afternoon' | 'evening' | 'night' | 'custom' | null;
}

export interface DoseLog {
	id: string;
	userId: string;
	medicineId: string;
	scheduleId: string;
	scheduledAt: string; // ISO UTC
	status: DoseLogStatus;
	doseAmount: number;
	doseUnit: DoseUnit;
	takenAt: string | null;
	snoozeCount: number;
	snoozedUntil: string | null;
}

// A dose_log joined with enough medicine fields to render a Dose Card/timeline
// row without a second round trip — what GET /api/today actually returns.
export interface DueDose {
	doseLog: DoseLog;
	medicine: Pick<Medicine, 'id' | 'name' | 'strength' | 'form' | 'accentIndex' | 'pillPhotoKey'>;
}

export interface TodayResponse {
	now: DueDose[]; // due within the current ~30-min window, grouped
	timeline: DueDose[]; // rest of today, in order
	supplyWarnings: Array<{
		medicineId: string;
		medicineName: string;
		daysRemaining: number;
		threshold: 7 | 2;
	}>;
}

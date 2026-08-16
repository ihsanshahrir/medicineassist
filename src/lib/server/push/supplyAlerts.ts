// Event-driven, not cron-scanned — called from take (dose-logs) and
// refill/supply-set handlers right after a write, per the plan: "recompute
// days_remaining; if it just crossed 7 or 2 and the flag isn't set, enqueue
// directly and set the flag." More accurate than scanning, and saves
// cron/D1 budget on something that changes only a few times a week.
import { estimateAvgDailyDose } from '$lib/shared/scheduleOccurrence';
import { markSupplyAlertSent, type MedicineRow } from '../db/queries/medicines';
import { getScheduleWithTimes } from '../db/queries/schedules';

// Mirrors the 'supply_alert' branch of workers/reminder-engine/src/types.ts's
// QueueMessage — kept as a separate local type rather than a shared import
// since that worker is a separate bundle (see M4's notes on why). Keep the
// two in sync by hand if this shape ever changes.
interface SupplyAlertMessage {
	type: 'supply_alert';
	user_id: string;
	medicine_id: string;
	medicine_name: string;
	days_remaining: number;
	threshold: 7 | 2;
}

export async function checkAndEnqueueSupplyAlert(
	db: D1Database,
	queue: Queue<SupplyAlertMessage>,
	medicine: MedicineRow
): Promise<void> {
	if (medicine.supply_count === null) return;

	const schedule = await getScheduleWithTimes(db, medicine.id);
	if (!schedule) return;

	const avgDaily = estimateAvgDailyDose({
		doseAmount: schedule.dose_amount,
		timesPerDay: schedule.times.length,
		repeatType: schedule.repeat_type as 'daily' | 'every_n_days' | 'weekdays',
		repeatIntervalDays: schedule.repeat_interval_days,
		weekdaysMask: schedule.weekdays_mask
	});
	if (avgDaily <= 0) return;

	const daysRemaining = Math.floor(medicine.supply_count / avgDaily);

	// Independent checks, not else-if: a big single decrement (or setting an
	// already-low count) can skip straight past 7 days to 2 — that should
	// still surface the more urgent warning, not just the one it skipped.
	if (daysRemaining <= 7 && !medicine.supply_alert_7d_sent) {
		await queue.send({
			type: 'supply_alert',
			user_id: medicine.user_id,
			medicine_id: medicine.id,
			medicine_name: medicine.name,
			days_remaining: daysRemaining,
			threshold: 7
		});
		await markSupplyAlertSent(db, medicine.id, 7);
	}
	if (daysRemaining <= 2 && !medicine.supply_alert_2d_sent) {
		await queue.send({
			type: 'supply_alert',
			user_id: medicine.user_id,
			medicine_id: medicine.id,
			medicine_name: medicine.name,
			days_remaining: daysRemaining,
			threshold: 2
		});
		await markSupplyAlertSent(db, medicine.id, 2);
	}
}

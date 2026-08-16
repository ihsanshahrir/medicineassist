// Matches the plan's queue message shape exactly. This worker is currently
// the only producer (its own cron scan enqueues what its own queue()
// consumes) — M5's supply-alert enqueueing from the root app's take/refill
// handlers will need this same shape mirrored there when it lands.
export type QueueMessage =
	| {
			type: 'dose_reminder' | 'dose_followup';
			dose_log_id: string;
			user_id: string;
			medicine_id: string;
			medicine_name: string;
			dose_amount: number;
			dose_unit: string;
			scheduled_at: string;
	  }
	| {
			type: 'supply_alert';
			user_id: string;
			medicine_id: string;
			medicine_name: string;
			days_remaining: number;
			threshold: 7 | 2;
	  };

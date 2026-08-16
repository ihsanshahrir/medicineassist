import { runScan } from './scan';
import { sendPushToUser } from './push';
import { markPushSent } from './db';
import type { QueueMessage } from './types';

function toPushPayload(message: QueueMessage) {
	switch (message.type) {
		case 'dose_reminder':
			return {
				title: `Time for ${message.medicine_name}`,
				body: `${message.dose_amount} ${message.dose_unit}${message.dose_amount === 1 ? '' : 's'}`,
				tag: `dose-${message.dose_log_id}`,
				url: '/today'
			};
		case 'dose_followup':
			return {
				title: `Still need to take ${message.medicine_name}?`,
				body: 'Tap to mark it taken or skipped.',
				tag: `dose-${message.dose_log_id}`,
				url: '/today'
			};
		case 'supply_alert':
			return {
				title: `${message.medicine_name} running low`,
				body: `About ${message.days_remaining} day${message.days_remaining === 1 ? '' : 's'} remaining`,
				tag: `supply-${message.medicine_id}`,
				url: `/medicines/${message.medicine_id}`
			};
	}
}

export default {
	async scheduled(_event, env, ctx) {
		ctx.waitUntil(runScan(env));
	},

	async queue(batch, env) {
		for (const message of batch.messages) {
			try {
				const delivered = await sendPushToUser(
					env,
					message.body.user_id,
					toPushPayload(message.body)
				);
				if (delivered && message.body.type !== 'supply_alert') {
					await markPushSent(env.DB, message.body.dose_log_id);
				}
				message.ack();
			} catch (err) {
				console.error('failed to process queue message', message.body.type, err);
				message.retry();
			}
		}
	}
} satisfies ExportedHandler<Env, QueueMessage>;

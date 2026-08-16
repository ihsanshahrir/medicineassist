import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// M0/M1 placeholder — returns fixture data shaped exactly like the real
// GET /api/today response (src/lib/shared/types.ts#TodayResponse) will be
// once M2 wires this up to D1. Swapping this for a real DB call later
// shouldn't require touching +page.svelte at all. The auth guard below,
// though, is real — every protected route checks locals.user this way.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(307, '/sign-in');

	return {
		now: {
			timeLabel: '8:00 AM',
			anchorLabel: 'morning' as const,
			anchorText: 'Morning',
			medicines: [
				{
					doseLogId: 'dl1',
					medicineId: 'm1',
					name: 'Metformin',
					strength: '500mg',
					accentIndex: 1,
					doseAmount: 2,
					doseUnit: 'tablet' as const,
					checked: false
				},
				{
					doseLogId: 'dl2',
					medicineId: 'm2',
					name: 'Amlodipine',
					strength: '5mg',
					accentIndex: 5,
					doseAmount: 1,
					doseUnit: 'capsule' as const,
					checked: false
				}
			]
		},
		timeline: [
			{ status: 'taken' as const, title: '6:00 AM · Vitamin D', subtitle: 'Taken at 6:04 AM' },
			{ status: 'pending' as const, title: '2:00 PM · Metformin', subtitle: '2 tablets' },
			{
				status: 'missed' as const,
				title: '10:00 PM · Amlodipine (yesterday)',
				subtitle: 'Not marked'
			}
		],
		supplyWarnings: [{ medicineId: 'm2', medicineName: 'Amlodipine', daysRemaining: 2 }]
	};
};

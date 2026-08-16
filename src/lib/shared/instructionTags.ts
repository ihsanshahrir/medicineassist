// Tag <-> pictogram-sprite-id <-> bilingual label. This is the one place the
// mapping is defined — components read from here rather than hardcoding ids,
// so a new tag only ever needs adding in one spot.
import type { InstructionTag, WarningTag } from './types';

/** Picks the label matching the user's language setting (see
 *  $lib/stores/userSettings.svelte) — the one part of the UI that's been
 *  bilingual since M0. Full UI-wide translation of every screen's static
 *  text is a separate, much larger undertaking not covered by this. */
export function tagLabel(meta: { en: string; ms: string }, language: 'en' | 'ms'): string {
	return language === 'ms' ? meta.ms : meta.en;
}

export const INSTRUCTION_TAG_META: Record<
	InstructionTag,
	{ picId: string; en: string; ms: string }
> = {
	with_food: { picId: 'pic-with-food', en: 'With food', ms: 'Bersama makanan' },
	before_food: { picId: 'pic-before-food', en: 'Before food', ms: 'Sebelum makan' },
	empty_stomach: { picId: 'pic-empty-stomach', en: 'Empty stomach', ms: 'Perut kosong' },
	swallow_whole: { picId: 'pic-swallow-whole', en: 'Swallow whole', ms: 'Telan bulat-bulat' },
	do_not_crush: { picId: 'pic-do-not-crush', en: 'Do not crush', ms: 'Jangan hancurkan' },
	shake_first: { picId: 'pic-shake-first', en: 'Shake first', ms: 'Goncang dahulu' }
};

export const WARNING_TAG_META: Record<WarningTag, { picId: string; en: string; ms: string }> = {
	drowsiness: {
		picId: 'pic-drowsiness',
		en: 'May cause drowsiness',
		ms: 'Boleh mengantuk'
	},
	no_alcohol: { picId: 'pic-no-alcohol', en: 'No alcohol', ms: 'Jangan alkohol' },
	do_not_drive: { picId: 'pic-do-not-drive', en: 'Do not drive', ms: 'Jangan memandu' },
	keep_refrigerated: {
		picId: 'pic-keep-refrigerated',
		en: 'Keep refrigerated',
		ms: 'Simpan di peti sejuk'
	}
};

// dose_unit (schedules.dose_unit) -> the dose-glyph symbol id
// (design/preview/foundations-dose-glyph.html). NOT the same vocabulary as
// medicines.form below — a schedule's unit is what one intake looks like
// ("2 tablets"), a medicine's form is what the product itself is ("syrup").
export const DOSE_UNIT_GLYPH: Record<string, string> = {
	tablet: 'glyph-tablet',
	half_tablet: 'glyph-half-tablet',
	capsule: 'glyph-capsule',
	ml: 'glyph-syrup',
	puff: 'glyph-inhaler',
	drop: 'glyph-syrup'
};

// medicines.form -> the dose-glyph symbol id, for contexts with only the
// medicine (e.g. the All Medicines list) and no schedule/dose_unit in scope.
export const MEDICINE_FORM_GLYPH: Record<string, string> = {
	tablet: 'glyph-tablet',
	capsule: 'glyph-capsule',
	syrup: 'glyph-syrup',
	inhaler: 'glyph-inhaler',
	drops: 'glyph-syrup',
	other: 'glyph-tablet'
};

// anchor_label -> time-of-day symbol id
export const TIME_ANCHOR_PIC: Record<string, string> = {
	morning: 'pic-sunrise',
	afternoon: 'pic-sun',
	evening: 'pic-sunset',
	night: 'pic-moon'
};

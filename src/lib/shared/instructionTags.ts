// Tag <-> pictogram-sprite-id <-> bilingual label. This is the one place the
// mapping is defined — components read from here rather than hardcoding ids,
// so a new tag only ever needs adding in one spot.
import type { InstructionTag, WarningTag } from './types';

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

// dose_unit -> the dose-glyph symbol id (design/preview/foundations-dose-glyph.html)
export const DOSE_UNIT_GLYPH: Record<string, string> = {
	tablet: 'glyph-tablet',
	half_tablet: 'glyph-half-tablet',
	capsule: 'glyph-capsule',
	ml: 'glyph-syrup',
	puff: 'glyph-inhaler',
	drop: 'glyph-syrup'
};

// anchor_label -> time-of-day symbol id
export const TIME_ANCHOR_PIC: Record<string, string> = {
	morning: 'pic-sunrise',
	afternoon: 'pic-sun',
	evening: 'pic-sunset',
	night: 'pic-moon'
};

// Workers AI call + free-text -> tag parsing for the OCR wizard (M3).
// Per the plan: this NEVER writes confirmed fields directly — it only ever
// returns an extraction for the client to render as unverified/low-conf rows
// (components-ocr-confirm-row.html's three states). The route handler is the
// only thing that persists anything, and only to `medicines.ocr_source` as
// an audit trail, never to the real columns.
import type { InstructionTag, WarningTag } from '$lib/shared/types';

const MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
const LOW_CONFIDENCE_THRESHOLD = 0.6;

export interface ExtractedField<T> {
	value: T;
	confidence: number;
}

export interface OcrExtraction {
	name: ExtractedField<string>;
	strength: ExtractedField<string>;
	form: ExtractedField<string>;
	doseAmount: ExtractedField<number>;
	doseUnit: ExtractedField<string>;
	frequencyPerDay: ExtractedField<number>;
	instructionsText: ExtractedField<string>;
}

export interface OcrResult {
	extracted: Partial<OcrExtraction>;
	instructionTagsSuggested: InstructionTag[];
	warningTagsSuggested: WarningTag[];
	lowConfidenceFields: string[];
	ocrFailed: boolean;
}

// The model's guided/schema-constrained JSON mode (response_format:
// json_schema) was found, via M7 local testing, to reliably deadlock into an
// ever-growing whitespace-repetition loop partway through this many
// properties, burning the whole token budget without ever closing the
// object. Plain `json_object` mode (valid-JSON-syntax only, no schema FSM)
// doesn't hit that failure mode, at the cost of the model having to follow
// the shape from prompt instructions alone — hence spelling every key out
// explicitly here rather than leaning on a schema to enforce it.
const PROMPT = `You are reading a photo of a pharmacy dispensing label or medicine box for a medication-reminder app. Extract what you can read into a single flat JSON object with exactly these keys (all optional except name/name_confidence — omit any key not legible on the label, don't invent values):

- name (string), name_confidence (number 0-1) — REQUIRED
- strength (string), strength_confidence (number 0-1)
- form (one of: tablet, capsule, syrup, inhaler, drops, other), form_confidence (number 0-1)
- dose_amount (number), dose_amount_confidence (number 0-1)
- dose_unit (one of: tablet, capsule, half_tablet, ml, puff, drop), dose_unit_confidence (number 0-1)
- frequency_per_day (number — how many times a day, e.g. "twice daily" -> 2), frequency_per_day_confidence (number 0-1)
- instructions_text (string), instructions_text_confidence (number 0-1)

Each confidence reflects how legible and certain that specific reading is — not your certainty about the whole photo. Use a LOW confidence (below 0.5) for anything blurry, partially cut off, or that you had to guess at.

Respond with ONLY the raw JSON object — no markdown fences, no explanation, no text before or after it.`;

interface RawModelOutput {
	name?: string;
	name_confidence?: number;
	strength?: string;
	strength_confidence?: number;
	form?: string;
	form_confidence?: number;
	dose_amount?: number;
	dose_amount_confidence?: number;
	dose_unit?: string;
	dose_unit_confidence?: number;
	frequency_per_day?: number;
	frequency_per_day_confidence?: number;
	instructions_text?: string;
	instructions_text_confidence?: number;
}

function field<T>(
	value: T | undefined,
	confidence: number | undefined
): ExtractedField<T> | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	return {
		value,
		confidence: typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : 0.5
	};
}

// Simple, deliberately dumb keyword match against the English instruction text
// (v1 is English-label OCR only, per the PRD's stated scope) — matches the 10
// pic-* symbols already in design/pictograms.svg via instructionTags.ts.
const INSTRUCTION_KEYWORDS: Array<[InstructionTag, RegExp]> = [
	['before_food', /before\s+(food|meal)/i],
	['empty_stomach', /empty\s+stomach/i],
	['with_food', /with\s+(food|meal)|after\s+(food|meal)/i],
	['swallow_whole', /swallow\s+whole|do\s+not\s+chew/i],
	['do_not_crush', /do\s+not\s+crush|do\s+not\s+break/i],
	['shake_first', /shake\s+(well|first)/i]
];
const WARNING_KEYWORDS: Array<[WarningTag, RegExp]> = [
	['drowsiness', /drowsy|drowsiness|may\s+cause\s+sleep/i],
	['no_alcohol', /alcohol/i],
	['do_not_drive', /do\s+not\s+drive|avoid\s+driving/i],
	['keep_refrigerated', /refrigerat|keep\s+cold|store.*fridge/i]
];

function parseTags(text: string): { instructionTags: InstructionTag[]; warningTags: WarningTag[] } {
	const instructionTags = INSTRUCTION_KEYWORDS.filter(([, re]) => re.test(text)).map(
		([tag]) => tag
	);
	const warningTags = WARNING_KEYWORDS.filter(([, re]) => re.test(text)).map(([tag]) => tag);
	return { instructionTags, warningTags };
}

function toDataUri(bytes: ArrayBuffer, contentType: string): string {
	let binary = '';
	const view = new Uint8Array(bytes);
	for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
	return `data:${contentType};base64,${btoa(binary)}`;
}

export const FAILED_RESULT: OcrResult = {
	extracted: {},
	instructionTagsSuggested: [],
	warningTagsSuggested: [],
	lowConfidenceFields: [],
	ocrFailed: true
};

export async function extractFromLabelPhoto(
	ai: Ai,
	photoBytes: ArrayBuffer,
	contentType: string
): Promise<OcrResult> {
	try {
		// `guided_json` is this model's officially typed structured-output
		// param (see worker-configuration.d.ts), but confirmed via M7 local
		// testing to be silently ignored on this model/runtime — it just
		// returns free-text chat, which broke JSON.parse below on every call.
		// `response_format` (OpenAI's structured-output convention) is what
		// the underlying serving backend actually honors here. It's not in
		// Cloudflare's own generated types yet (hence the intersection type
		// below, itself named after that generated type — regenerate this if
		// `wrangler types` ever renames it).
		const request: Ai_Cf_Mistralai_Mistral_Small_3_1_24B_Instruct_Messages & {
			response_format: { type: 'json_object' };
		} = {
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', text: PROMPT },
						{ type: 'image_url', image_url: { url: toDataUri(photoBytes, contentType) } }
					]
				}
			],
			response_format: { type: 'json_object' },
			// Guided decoding on this model was observed (M7 local testing) to
			// occasionally get stuck in a token-repetition loop (repeated
			// digits, repeated whitespace) that never naturally closes the
			// JSON object. frequency_penalty directly discourages re-picking
			// an already-repeated token; max_tokens is raised as a margin of
			// safety on top, not the primary fix.
			frequency_penalty: 0.5,
			max_tokens: 800
		};
		const output = await ai.run(MODEL, request);

		// response_format-driven output arrives already parsed as an object;
		// guided_json (and plain chat) would have arrived as a JSON string.
		// Handle both so this doesn't re-break if the backend's behavior
		// shifts back.
		const raw = (
			typeof output.response === 'string' ? JSON.parse(output.response) : output.response
		) as RawModelOutput;
		if (!raw.name) return FAILED_RESULT;

		const extracted: Partial<OcrExtraction> = {
			name: field(raw.name, raw.name_confidence),
			strength: field(raw.strength, raw.strength_confidence),
			form: field(raw.form, raw.form_confidence),
			doseAmount: field(raw.dose_amount, raw.dose_amount_confidence),
			doseUnit: field(raw.dose_unit, raw.dose_unit_confidence),
			frequencyPerDay: field(raw.frequency_per_day, raw.frequency_per_day_confidence),
			instructionsText: field(raw.instructions_text, raw.instructions_text_confidence)
		};
		// Drop the undefineds `field()` produced above rather than shipping them as literal keys.
		for (const k of Object.keys(extracted) as (keyof OcrExtraction)[]) {
			if (extracted[k] === undefined) delete extracted[k];
		}

		const lowConfidenceFields = (Object.entries(extracted) as [string, ExtractedField<unknown>][])
			.filter(([, f]) => f.confidence < LOW_CONFIDENCE_THRESHOLD)
			.map(([k]) => k);

		const { instructionTags, warningTags } = extracted.instructionsText
			? parseTags(extracted.instructionsText.value)
			: { instructionTags: [], warningTags: [] };

		return {
			extracted,
			instructionTagsSuggested: instructionTags,
			warningTagsSuggested: warningTags,
			lowConfidenceFields,
			ocrFailed: false
		};
	} catch {
		return FAILED_RESULT;
	}
}

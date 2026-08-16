# Design System Rules — MedsAssist

**Drop this file at the root of the `medicineassist` repo.** It's read by anyone (or any
agent — Claude Code, an IDE assistant, etc.) adding or changing UI, so new work stays
consistent with the design system instead of drifting.

## Source of truth

- Tokens: `design/colors_and_type.css` — every color, type size, spacing, radius,
  shadow, and touch-target value. Never hardcode a hex, px, or font value that
  already has a token; use the CSS variable.
- Icons: `design/pictograms.svg` (sprite) — reference via `<use href="pictograms.svg#id"/>`,
  never redraw or inline-duplicate a symbol.
- Live specimens: `design/preview/*.html` (23 cards — foundations, pictograms,
  components, full screens). When unsure how something should look, check the
  matching card before inventing a pattern.
- Full rationale: `design/README.md` (contrast verification, touch-target rules,
  text-scaling proof, known follow-ups).

## Rules for any new screen, component, or change

1. **Reuse tokens, don't add them.** New color/spacing/radius needs go back to the
   design system project first (`MedsAssist Design System`), not directly into app code.
2. **Never invent a red/alarm treatment for missed doses.** Missed state uses
   `--state-missed-text` / `--state-missed-bg` (neutral grey) — this is a deliberate
   product decision (design principle 8), not an oversight.
3. **Contrast floor is WCAG AAA** (7:1 text, 3:1 non-text), not AA — the audience
   skews older. Check new pairings against `design/README.md`'s table before shipping.
4. **Touch targets ≥48×48px** (`--tap-min`), primary actions 56px (`--tap-primary`),
   ≥8px between adjacent targets (`--tap-gap`).
5. **Body text floor is 18px** (`--t-body-size`) — nothing smaller except `--t-caption-size`
   (15px), used sparingly.
6. **Light theme only for now.** If dark mode is added, introduce a `[data-theme="dark"]`
   block that redefines the same token names — don't rename tokens to accommodate it.
7. **`'Inter'` is the intended font** but isn't self-hosted yet — see the Known
   follow-ups in `design/README.md` before swapping fonts.
8. **Pictograms are an unvalidated first pass** — don't treat them as final; flag if a
   new screen needs a symbol that doesn't exist yet rather than drawing one ad hoc.

## When the design system changes upstream

Re-pull `design/` from the `MedsAssist Design System` project (via `/design-sync` or a
manual copy) rather than hand-editing tokens locally — local edits will be overwritten
and cause drift between the design source and the app.

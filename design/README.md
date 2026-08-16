# MedsAssist Design System

Local, sync-ready design system for MedsAssist — built from [docs/PRD.md](../docs/PRD.md).
Visual direction: **Calm Clinical** (muted sage/teal on warm off-white, 20px radius, soft
shadows). Light theme only for v1, with tokens structured so dark can be added later
without renaming anything.

## Structure

```
design/
  colors_and_type.css     ← single source of truth for every token
  pictograms.svg          ← 19-symbol sprite (14 instruction/warning/time marks + 5 dose glyphs)
  preview/
    _card.css             ← shared specimen frame + phone frame
    foundations-*.html    ← 5 cards: color, type, spacing/radius, elevation/targets, dose glyph
    pictograms-*.html     ← 4 cards: how-to-take, warnings, time-of-day, construction spec
    components-*.html     ← 8 cards: buttons, dose card, medicine row, instruction tile,
                             OCR confirm row, form controls, supply meter, feedback
    screens-*.html        ← 6 cards: Today, Medicine Detail, Add–OCR Confirm, Add–Schedule,
                             Settings, and a 200%-text-scale proof of Today
```

23 preview files total. Every file's first line is an `@dsCard` comment
(`group`, `name`, `subtitle`, `viewport`) — that's what builds the Claude Design pane
index, so no manual asset registration is needed.

Icons are referenced from the shared sprite via `<use href="../pictograms.svg#id"/>`
rather than duplicated inline — standard sprite practice, and it means every card and
the real app draw from the exact same 19 symbols.

## Previewing locally

```
cd design && python3 -m http.server 8743
# open http://localhost:8743/preview/screens-today.html (or any card)
```

Every preview file is self-contained and renders standalone — no build step.

## Syncing to Claude Design

This bundle was built to be pushed by `/design-sync`, not by me — that skill is
reserved for explicit user invocation. To publish it:

1. Run `/design-sync` from this repo.
2. Point it at a **new** design-system project named `MedsAssist Design System`
   (the account's only existing project, `AfterPayday Design System`, is unrelated).
3. Set `localDir` to `design/`.

## Contrast verification

Every text/background pairing in `colors_and_type.css` was checked against WCAG AAA
(7:1 for text, 3:1 for non-text) — the PRD's stated bar, above AA's 4.5:1, because the
audience skews older. Computed ratios (sRGB relative luminance):

| Pair | Ratio | Bar |
|---|---|---|
| `--ink` on `--ground` | ~16.5:1 | text 7:1 |
| `--ink-2` on `--surface` (white) | ~8.8:1 | text 7:1 |
| white on `--sage-700` (primary button) | ~7.8:1 | text 7:1 |
| `--warn-text` on white | ~8.1:1 | text 7:1 |
| `--danger-text` on white | ~10.0:1 | text 7:1 |

`--state-missed-text` deliberately reuses `--ink-2` rather than a new mid-tone grey —
a distinct lighter grey was tried first and measured ~5.9:1, which fails AAA, so the
missed state borrows the already-verified token instead of introducing a weaker one.

`--ink-3` and the medicine accent hues are fills/decoration only and are never used
for text, so they're exempt from the text ratio and were checked against the 3:1
non-text bar instead.

## Touch targets

Every interactive element across the component and screen cards is ≥48×48px
(`--tap-min`), with the primary "Taken" action at 56px (`--tap-primary`) and a minimum
8px gap between adjacent targets (`--tap-gap`) — see `foundations-elevation-targets.html`.

## Text scaling

All type is set in `rem` off the tokens in `colors_and_type.css`. `screens-today-200pct.html`
applies `html { font-size: 200% }` to the assembled Today screen as a direct proof of
the PRD's acceptance criterion — card padding and button sizing hold, text wraps, and
nothing clips or forces horizontal scroll.

## Known follow-ups (not blocking this build)

- **Font**: `--font-sans` lists `'Inter'` first with a faithful system-font fallback.
  Inter needs to be self-hosted (woff2, Latin Extended for Bahasa Malaysia diacritics)
  in the production build — this design system doesn't embed font files.
- **Pictograms are a first drawn pass**, not a validated set. The PRD's Validation Plan
  (item 3) requires showing each mark cold, no context, and redrawing anything under
  85% comprehension with Malaysian users before launch. Treat `pictograms.svg` as a
  starting point for that test, not a finished asset.
- **No dark theme** — v1 decision. If added later, introduce a `[data-theme="dark"]`
  block that redefines the same token names; nothing here should need renaming.
- **Pill photos are placeholder swatches** (accent color + glyph) in every screen —
  no real photography was in scope for this pass.

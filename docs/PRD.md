# MedsAssist — Product Requirements Document (v1 MVP)

## Context

The problem: people on multiple medicines forget doses, take the wrong thing, don't know what a medicine is actually for, and run out without noticing. Existing apps (Medisafe, MyTherapy, Round Health) solve the reminder well but are cluttered, US-centric, and treat "what is this pill and how do I take it" as a footnote. Nothing serves Malaysian/SEA households well — local medicine names, Bahasa Malaysia, and habits like meal- and prayer-anchored routines are unaddressed.

The intended outcome of v1: a person adds their medicines in under two minutes by photographing the box, and from then on opens one screen that shows — with a real photo of the actual pill — what to take right now, how many, and how to take it. Plus it tells them when they'll run out.

**Delivery target:** desktop-capable responsive web app, installable as a PWA on iOS and Android home screens.

---

## Discovery decisions (confirmed with the user)

| Decision             | Choice                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Primary user         | **Any adult on multiple meds** — not age-targeted. Accessibility is a quality bar, not the positioning. |
| Medicine data source | **Photo/OCR of the pharmacy label or box**, pre-filling a form the user confirms.                       |
| Reminder mechanism   | **Server-sent web push, best-effort.** Backend exists from day one.                                     |
| Market / language    | **Malaysia / SEA** — Bahasa Malaysia + English.                                                         |
| v1 features          | Today view + mark taken · Medicine detail & how-to-take · Supply count & refill alerts                  |
| Caregiver layer      | **v2** — v1 is solo, one person, one account.                                                           |
| Schedule complexity  | **Simple recurring only** (N×/day, every N days, specific weekdays, start/end date).                    |
| Accounts             | **Required upfront.**                                                                                   |

---

## Research foundation

Everything below is evidence gathered from published research, not intuition. It drives the design principles in the next section.

**Older adults fail on perceptual-motor and cognitive load, in that order.** Documented usability failures are small fonts, small buttons, too many options per screen, too many steps in data entry, and inadequate navigation guidance. Dense instruction text and language barriers directly reduce willingness to use medication reminder apps. ([Prospective usability study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7298635/), [QFD optimization study](https://www.mdpi.com/2079-9292/12/13/2860))

**Put the basics on the home screen.** Research on elderly medication reminder apps concludes that core functions and buttons belong on the primary page — searching for them is the main efficiency loss. Users care overwhelmingly about _time_ and _dosage_, not advanced features. ([QFD study](https://www.mdpi.com/2079-9292/12/13/2860))

**The gap is retention, not installation.** Uptake of health apps runs ~92%, but sustained adherence sits around ~62%, with attrition climbing from ~19% to ~28% over a trial. Reminders alone are not enough — condition-specific relevance and human support are what hold people. ([Narrative review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12549263/), [AJMC on attrition](https://www.ajmc.com/view/addressing-uptake-adherence-and-attrition-in-mental-health-apps))

**Pictograms measurably beat text alone.** Groups given text-plus-pictograms score significantly higher on comprehension of medication instructions than text-only groups. Images are processed, retained, and recalled more easily. Crucially, effectiveness depends on cultural adaptation and on explicitly teaching what each image means. ([USP Pictograms](https://qualitymatters.usp.org/improving-health-literacy-usp-pictograms), [low-literacy pictogram study](https://pmc.ncbi.nlm.nih.gov/articles/PMC10623492/), [validated pictorial aids editorial](https://pmc.ncbi.nlm.nih.gov/articles/PMC11825315/))

**Behaviour-change techniques are what move adherence, not notifications.** Across 55 RCTs, interventions containing explicit behaviour-change techniques significantly outperformed those without. The effective combinations centre on increasing knowledge, awareness, self-efficacy, and action control. Two-way engagement beats one-way messaging. ([QCA of 60 studies](https://systematicreviewsjournal.biomedcentral.com/articles/10.1186/s13643-016-0255-z), [Behaviour Change Wheel evaluation](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5920150/))

**Accessibility floor for this audience.** WCAG 2.2 AA requires 24×24 CSS px targets; AAA is 44×44. Guidance for elderly-facing apps recommends **48×48 minimum**, body text ≥16px, and aiming for **AAA contrast (7:1)** rather than AA's 4.5:1, because ageing eyes need the margin. The app must respect OS text-size settings without breaking layout. ([WCAG target size](https://testparty.ai/blog/wcag-target-size-guide), [elderly app accessibility standards](https://imalive.co/accessibility-standards-elderly-safety-apps), [mobile WCAG 2026 guide](https://www.accessitool.com/blog/wcag-mobile-requirements-complete-guide-app-web-developers-2026))

**Family involvement is wanted.** Older adults report being very willing to share medication information with family and to receive reminders from them. Medisafe's "Medfriend" and MyTherapy's team feature both exist for this reason — it validates the v2 caregiver layer. ([Frontiers, age-friendly interfaces](https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2026.1749507/full), [app comparison](https://www.onlinedoctor.com/best-medicine-reminder-apps/))

### The hard platform constraint

**Reliable offline alarms are not available to a PWA.** Google's Notification Triggers API — the only way to schedule a local notification without a network — [was cancelled](https://developer.chrome.com/docs/web-platform/notification-triggers); Google stated it could not provide consistent, reliable cross-platform experiences. On iOS, the Push API works **only** for apps added to the Home Screen via Safari (iOS 16.4+), never in a browser tab, and Background Sync is unsupported. In the EU, the DMA change removed standalone PWA support entirely. ([iOS PWA limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [PWA 2026 state of play](https://blog.codercops.com/blog/progressive-web-apps-2026))

**Product consequence, stated plainly:** MedsAssist can send a _good_ reminder. It cannot promise an _alarm_. This must be designed for honestly (see §F6 The reminder contract), not papered over — a reminder app that silently fails is worse than none.

---

## Product definition

**One-liner:** MedsAssist shows you exactly what to take right now — with a photo of the actual pill — and tells you when you'll run out.

**Positioning:** Not "a reminder app with a medicine list." It is a **medicine comprehension tool that happens to remind you.** The differentiator is that every medicine has a real photo, a plain-language "what this is for," and pictogram-backed instructions — in Bahasa Malaysia or English.

### Personas

- **Primary — "Aina, 41."** Manages her own three chronic medicines plus supplements. Busy, phone-native, forgets the evening dose. Wants setup to take seconds and the daily check to take one glance. She is the person who installs the app.
- **Primary — "Encik Rahman, 68."** Nine medicines across four times of day. Reads Bahasa more comfortably than English. Confuses two white round tablets. Needs large text, high contrast, and the pill photo above all else. He may be onboarded by Aina but uses it himself daily.
- **Shadow persona (v2) — the family member** who wants to know Dad took his morning dose.

Designing for Rahman makes the app better for Aina. Designing only for Aina makes it unusable for Rahman. **All v1 UI is built to Rahman's bar.**

### Non-goals for v1

- No drug–drug interaction checking. Requires licensed clinical data and carries real safety liability. v3 at the earliest.
- No diagnosis, dose recommendations, or any medical advice. The app repeats what the label says; it never originates clinical guidance.
- No caregiver/multi-profile management, no adherence reports, no doctor export — all v2.
- No PRN/as-needed meds, no tapering or day-varying doses.
- No wearables, no smart pill dispensers, no pharmacy/EHR integration.
- No social feed, no leaderboards, no shame-based streak mechanics.

---

## Design principles

These are binding constraints on every screen, derived from the research above.

1. **One decision per screen.** Never present two competing primary actions.
2. **48×48px minimum touch target**, 8px minimum spacing between adjacent targets.
3. **Body text ≥18px** (above the 16px floor, because our median user is older). Full support for OS text scaling up to 200% without horizontal scroll or clipping.
4. **Contrast ≥7:1 for all text** (AAA), ≥3:1 for meaningful non-text UI. Never encode meaning in colour alone — always colour _plus_ icon _plus_ label.
5. **Photo before text, always.** The pill image is the primary identifier on every surface where a medicine appears.
6. **Every instruction gets a pictogram.** Text alone is a failure state.
7. **Undo, never confirm.** No "Are you sure?" dialogs for routine actions — mark-as-taken is one tap with a 10-second undo. Confirmation dialogs are reserved for deletion.
8. **Never guilt the user.** A missed dose is reported neutrally and factually. No red alarm styling, no broken-streak animations, no "you failed" language. Adherence research supports self-efficacy; shame undermines it.
9. **Offline-readable.** The day's schedule, all medicine details, and all photos must render with no network. Only push and sync require connectivity.
10. **No jargon.** "Take on an empty stomach" not "administer sub-prandially." Target a Grade 6 reading level in both languages.

---

## v1 feature specification

### F1 — Account & onboarding

Sign-in is required before first use (confirmed decision). The friction is real, so it is mitigated hard:

- **One screen, passwordless.** Phone number or email → 6-digit code. No password to create, forget, or reset. Optional Google sign-in.
- Large numeric keypad, code auto-fills from SMS/email where the platform allows.
- Immediately after sign-in, a **3-card orientation** (skippable, re-openable from Settings):
  1. _What this app does_ — one sentence + illustration.
  2. **Install to Home Screen** — platform-detected, illustrated, step-by-step. This is not optional polish: on iOS, push notifications are impossible without it. Users who skip see a persistent, dismissible banner until they install.
  3. **Reminder expectations** — plainly states that reminders need internet and a home-screen install, and that this app is not an alarm clock. Offers "also set a phone alarm as backup" with instructions.
- Then straight into **Add your first medicine**. No empty dashboard.

### F2 — Add a medicine (the OCR flow)

Setup abandonment is the single biggest failure mode. The flow is built to make the fast path genuinely fast and the manual path never a dead end.

```
[Photograph the box or pharmacy label]
        ↓  (OCR + extraction)
[Review & confirm — pre-filled fields, each individually editable]
        ↓
[Photograph the actual pill]   ← separate, deliberate step
        ↓
[When do you take it?]         ← schedule picker
        ↓
[How many do you have?]        ← supply count
        ↓
                 Done
```

**Step 1 — Capture.** Camera-first with a framing guide. Accepts the pharmacy dispensing label _or_ the retail box. Alternatives always visible: "Type it in instead" and "Choose from gallery."

**Step 2 — Confirm.** OCR pre-fills: medicine name, strength, form (tablet/capsule/syrup/inhaler/drops), dose per intake, frequency, and instruction text. Every field is a large, tappable, editable row.

- **Extracted fields are visually marked as unverified** until the user taps to accept them. Nothing OCR-derived is treated as truth silently — this is the core safety property of the flow.
- Low-confidence fields are flagged individually rather than failing the whole capture.
- Free-text instructions are parsed into structured tags where possible (`with food`, `before food`, `swallow whole`, `do not drive`) and each tag renders as a pictogram the user can confirm or remove.
- If OCR fails entirely, the app drops to the manual form with the photo attached — never a dead end, never a re-shoot demand.

**Step 3 — Pill photo.** Prompts for a photo of the actual tablet/capsule, ideally on a plain surface. This is the highest-value asset in the whole product; it is what stops someone taking the wrong white round tablet. Skippable, but the app asks again later. If skipped, the user picks shape + colour from a visual grid to generate a representative glyph.

**Step 4 — Schedule.** Simple recurring only:

- **Times per day** (1–6), each with a time.
- **Preset anchors offered first**: Morning / Afternoon / Evening / Night, with editable default times. Anchored routines beat arbitrary clock times for habit formation.
- **Repeat pattern**: every day · every N days · specific weekdays.
- **Start date** and **optional end date**.
- **Dose per intake** shown as repeated pill glyphs, not just a number (see §Visual language).

**Step 5 — Supply.** "How many tablets do you have right now?" with a large numeric stepper. Optional. Enables F5.

**Target: under 90 seconds per medicine on the OCR path.** This is a measured acceptance criterion, not an aspiration.

### F3 — Today view (home screen)

The app opens here, always. Structure, top to bottom:

**A. The Now card** — dominates the viewport. Shows the next or currently-due dose group:

- Time-of-day icon + large time ("8:00 AM · Morning")
- For each medicine due: pill photo (large), name, strength, and dose as repeated glyphs
- One full-width **"Taken"** button (≥56px tall)
- Secondary: **Snooze 15 min** and **Skip** as clearly smaller, lower-contrast controls
- After tapping: card collapses with a checkmark and a **10-second Undo** — no dialog

**B. Today's timeline** — every dose group for the day in vertical order, each with state: `Done` (checkmark) · `Now` (highlighted) · `Upcoming` (neutral) · `Missed` (neutral grey with a plain "not marked" label — **not red, not alarming**).

**C. Supply warnings** — surfaces only when a medicine is running low.

Nothing else. No stats, no charts, no promotional cards, no bottom-sheet upsells.

**Dose grouping:** medicines due within the same 30-minute window are grouped into a single card with a single "Taken all" action, plus per-medicine checkboxes for partial completion. Rahman on nine medicines must not face nine separate cards at breakfast.

### F4 — Medicine detail

Reached by tapping any medicine anywhere. This is where the "comprehension tool" positioning lives.

| Section            | Content                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Identity**       | Large pill photo, name, strength, form. Box photo viewable.                                                                                                        |
| **What it's for**  | One or two plain sentences. User-editable; OCR-suggested where the label states an indication. Never invented by the app.                                          |
| **How to take it** | Dose as repeated glyphs, times, and every instruction rendered as **pictogram + short text pair** (with food / empty stomach / swallow whole / shake first / etc.) |
| **Warnings**       | A visually distinct "Be careful" block — drowsiness, alcohol, driving. Pictogram-led. Only what the label says.                                                    |
| **Supply**         | Tablets remaining, days remaining, projected run-out date.                                                                                                         |
| **Schedule**       | Current schedule, with Edit.                                                                                                                                       |
| **Notes**          | Free-text field for anything the doctor or pharmacist said.                                                                                                        |

A **"Read this to me"** button plays the whole page via text-to-speech in the selected language. High value for low-vision and low-literacy users, low cost to build.

### F5 — Supply tracking & refill alerts

- Each "Taken" decrements the supply count by the dose amount.
- Detail page and Today view show **days remaining**, computed from the actual schedule.
- **Two alerts**: at 7 days remaining ("time to arrange a refill") and at 2 days ("you'll run out on Thursday"). Both delivered as push _and_ as an in-app banner, because push is not guaranteed.
- **"I got a refill"** — one tap, enter quantity, count resets.
- **Course completion:** a medicine with an end date _and_ a supply count (e.g. antibiotics: 7 days, 21 tablets) displays a progress bar — "Day 3 of 7" — and a clear completion state. This delivers the "finish the whole course" behaviour without introducing a separate course object into the schedule model, keeping v1 at "simple recurring only" as decided.

### F6 — The reminder contract

Given the platform constraint, v1 is explicit about what it promises.

**What we do:**

- Server-sent web push at each scheduled dose time, to every registered home-screen install.
- Notification body carries the medicine name and dose so it is useful from the lock screen without opening the app.
- Action buttons on the notification where the platform supports them: **Taken** / **Snooze**.
- **One follow-up push** at +30 minutes if a dose is still unmarked. Exactly one. Repeated nagging is the top-cited reason people mute health apps.
- **Snooze is bounded**: 15 minutes, maximum two snoozes, then it goes to "not marked." Unlimited snooze is how a reminder becomes wallpaper.
- **Quiet hours** are respected — no push between user-set sleep times; those doses surface in-app instead.

**What we say out loud** (in onboarding, in Settings, and in a persistent Settings status row):

- Reminders need internet and a home-screen install.
- iOS will not deliver anything if the app was opened in a browser tab rather than installed.
- This is not a replacement for a phone alarm for critical medicines.

**Settings shows a live "Reminder health" row:** _Notifications: On · Installed to Home Screen: Yes · Last reminder delivered: 8:00 AM today._ If any element is broken, this row explains the specific fix. Silent failure is the worst possible outcome for this product, so the failure state is made visible by design.

### F7 — Accessibility & language

- **Bahasa Malaysia and English**, switchable at any time from Settings, no restart. Language choice is offered on the very first screen.
- All pictograms carry a text label in the active language. Icons are never load-bearing on their own.
- **Text size control inside the app** (Normal / Large / Extra Large) _in addition to_ honouring OS scaling — many users never discover their phone's accessibility settings.
- Full keyboard navigation and correct focus order for the desktop web experience.
- Screen-reader labels on every control; dose amounts announced as words ("two tablets"), not glyph counts.
- Tested at 200% zoom and with the system's largest text setting.

---

## Visual language

**The dose glyph.** "Take 2 tablets" renders as the number _and_ two pill shapes: `● ●  2 tablets`. Numerals are a known weak point for low-numeracy and cognitively-declining users; a countable visual removes the ambiguity. Applies to tablets and capsules; syrups show a marked spoon/cup graphic with the volume, inhalers show a puff count.

**Time-of-day iconography.** Sunrise / sun / sunset / moon accompany every time, everywhere. Recognisable long before the digits are read, and language-independent.

**Pictogram set.** Adapted from the USP model, which is validated but Western-drawn. The set must be **redrawn and comprehension-tested with Malaysian users** — the research is unambiguous that pictograms only work when culturally aligned, and that their meaning must be taught explicitly. Each pictogram's meaning is shown as text on first encounter and is always tappable for a plain-language explanation.

**Colour.** A calm, warm, low-saturation palette — this is a health app for daily use, not a dashboard. Colour is decorative and supportive; state is always carried by icon + label as well. Every medicine gets a stable accent colour assigned at creation for fast scanning, which never replaces the photo as the identifier.

**Layout.** Single-column on mobile. On desktop and tablet, the same single column stays centred and capped at a readable measure, with the Today timeline optionally alongside. The desktop build is not a denser information layout — it is the same app, comfortably sized.

---

## Recommendations beyond v1 scope

These are things the research and the market gap suggest would materially improve outcomes. **None are in v1**; they are laid out so the v1 architecture doesn't foreclose them.

### Tier 1 — highest expected impact (target v2)

1. **Caregiver "watcher" link.** A read-only invite so a family member sees today's status and gets a nudge on a missed dose. The evidence is consistent that human support beats notifications for adherence and reduces dropout, and older adults actively want family involved. This is the single largest available lift.
2. **Adherence history + doctor report.** A calendar view plus a one-tap shareable summary for appointments. Converts the app from a utility into something with recurring value, and gives a reason to keep data in it.
3. **Meal- and prayer-anchored scheduling.** Let users schedule "after breakfast" or "after Maghrib" rather than 8:00 PM, with local prayer times resolving to actual clock times. Habit anchoring to an existing routine is well-supported by behaviour-change literature, and prayer-time anchoring is a real, unserved SEA differentiator.
4. **Ramadan / fasting mode.** A guided flow to shift daytime doses to suhoor and iftar windows, with an explicit "check with your doctor or pharmacist before changing timing" gate. This is a genuine annual pain point across the target market that no international competitor addresses.

### Tier 2 — strong differentiators

5. **PRN / as-needed medicines** with a minimum-gap safety guard ("last taken 2 hours ago — wait 2 more hours"). Real safety value for painkillers and inhalers.
6. **Two-way check-in.** A short weekly "how are you feeling on this medicine?" prompt. The evidence favours two-way engagement over one-way messaging, and it surfaces side effects worth telling a doctor about.
7. **Voice input for adding a medicine** — speak the name and schedule. Strong for arthritic hands and low typing confidence.
8. **Halal / ingredient flags.** Surface porcine-gelatin capsules and alcohol-containing syrups where the data supports it. Highly relevant to the target market, and simply absent from every competitor.
9. **Print-friendly medicine card.** A physical A4 sheet with photos and times, for the fridge door. Many in the target demographic trust paper more than a phone, and it functions as low-cost word-of-mouth.
10. **Travel / timezone handling.** Explicitly ask on timezone change whether to shift doses or hold the original schedule.

### Tier 3 — later, higher cost or higher risk

11. **Drug interaction checking.** High user value, but requires licensed clinical data and a serious liability review. Do not build casually.
12. **Pill imprint identification** ("what is this loose tablet?"). Depends on an imprint database with local coverage; SEA coverage is poor.
13. **Pharmacy refill handoff** — a prepared WhatsApp message to a saved local pharmacy. Very natural in this market, low technical cost, high perceived value.
14. **Multiple profiles under one account** (managing a parent's meds directly).
15. **Native app wrapper**, if and only if reminder reliability proves to be the binding constraint on retention. The measurement to justify this should be built into v1 (see metrics).

### Explicitly recommended _against_

- **Streaks, badges, and leaderboards.** Gamification that punishes a break directly undermines the self-efficacy that adherence depends on, and a missed dose is often legitimate. If any progress mechanic is used, it should be a gentle non-breaking summary ("22 of 25 doses this month"), never a streak that shatters.
- **Any AI-generated medical content.** The app may reformat and translate what a label says. It must never generate clinical claims. This boundary is a product rule, not a technical one.

---

## Success metrics

| Metric                                            | v1 target          | Why                                                                                                      |
| ------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| Setup completion (sign-in → first medicine saved) | ≥80%               | Directly measures the OCR flow; the largest known drop-off point.                                        |
| Time to add first medicine                        | median <90s        | The core promise of the OCR path.                                                                        |
| Home-screen install rate                          | ≥60% of signups    | Push is impossible without it on iOS; a leading indicator of whether reminders work at all.              |
| Day-7 retention                                   | ≥55%               | Benchmark literature shows adherence settling near 62% with attrition to ~28%.                           |
| Day-30 retention                                  | ≥40%               | The real test — this is where competitors lose people.                                                   |
| Doses marked / doses scheduled                    | ≥70%               | Proxy for adherence and for reminder effectiveness.                                                      |
| Push delivery→interaction rate                    | tracked, no target | **Instrument this from day one.** It is the evidence that decides whether a native wrapper is necessary. |
| Pill photos attached                              | ≥50% of medicines  | The core differentiator; low uptake means the prompt needs redesign.                                     |

---

## Risks

| Risk                                                      | Severity       | Mitigation                                                                                                                                                                                        |
| --------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Push proves unreliable enough to break trust**          | High           | Honest expectation-setting in onboarding; a visible "Reminder health" status row; an in-app catch-up view; instrument delivery rates to decide on a native wrapper with data rather than opinion. |
| **OCR misreads a dose** and the user accepts it unchecked | High (safety)  | Extracted fields are marked unverified until explicitly accepted; low-confidence fields flagged individually; the original label photo is retained and always viewable on the detail page.        |
| **Account-required sign-in loses users at screen one**    | Medium-High    | Passwordless one-screen OTP; no password creation; measure drop-off precisely and revisit if it exceeds 20%.                                                                                      |
| Setup effort exceeds perceived benefit for 5+ medicines   | Medium         | OCR speed is the whole answer; allow adding medicines incrementally rather than demanding a complete list upfront.                                                                                |
| Pictograms misread by the target culture                  | Medium         | Redraw for the local market and comprehension-test before launch; always pair with text; make every pictogram tappable for a plain explanation.                                                   |
| Perceived as medical advice                               | Medium (legal) | Persistent, plainly-worded disclaimer; the app only repeats user- or label-sourced content; no interaction checking, no dose recommendations in v1.                                               |
| Sensitive health data in a v1 product                     | Medium         | Minimum viable collection, encryption in transit and at rest, no third-party analytics on medicine content, clear export and delete. Formalise before any caregiver sharing ships in v2.          |

---

## Screen inventory (v1)

1. Language select → Sign in (OTP) → Orientation (3 cards, incl. Add to Home Screen)
2. **Today** (home)
3. Add medicine: Capture → Confirm → Pill photo → Schedule → Supply → Done
4. Medicine detail (+ Read to me)
5. Edit medicine / Edit schedule
6. All medicines (list)
7. Refill (update supply count)
8. Settings: language · text size · notifications & reminder health · quiet hours · account · export/delete · about & disclaimer

Eight destinations total. Anything beyond this list is v2.

---

## Validation plan

The PRD is a hypothesis. Before any code, and again on the first build:

1. **Paper/clickable prototype test with 5 users** — three aged 60+, two aged 30–50, at least two Bahasa-primary. Tasks: add a medicine from a real box; work out what to take right now; work out how many days of supply are left.
2. **Measure without prompting**: task completion, time to complete, and every point where the user hesitates or asks a question. Any task under 80% unaided completion means that screen is redesigned before it is built.
3. **Pictogram comprehension test** — show each pictogram cold, with no context, and ask what it means. The research requires this; anything under 85% correct gets redrawn.
4. **Accessibility audit on the first build** — 200% zoom, largest OS text setting, screen reader end-to-end, contrast checker on every text/background pair, and every touch target measured against 48px.
5. **Reminder reliability trial** — install on real iOS and Android devices and log scheduled-vs-delivered push over 7 days, including overnight, offline, and low-power-mode conditions. This number decides the native-wrapper question.

---

## Next step

This PRD deliberately stops at the product boundary — no backend, data model, or stack decisions. The natural follow-on, once this is approved, is the technical design: data model, OCR approach, push infrastructure, offline/sync strategy, and the stack. Recommend keeping that a separate document.

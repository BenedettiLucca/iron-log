# Sprint 4 — Android Physical QA Runbook

**Scope:** Bio, Analytics, Evolution, Check-in and Goals  
**Runtime baseline:** `17eceeb` (`feat/open-design-redesign`)  
**Goal:** approve the Sprint 4 dense-data redesign without mixing in Sprint 5 or native dependency changes.

## Evidence convention

Capture only failures and the required approval screenshots. Use:

```text
s4-{screen}-{theme}-{language}-{font}-{state}.png
```

Examples:

```text
s4-analytics-dark-es-1.3-dense.png
s4-goals-light-pt-1.0-empty.png
```

Report a defect as one line plus screenshot:

```text
[screen/state] expected → actual
```

Do not begin runtime, dependency or documentation fixes during the collection pass. Wait for the complete issue list and every required approval capture.

## Preflight

- [ ] Run the app from `feat/open-design-redesign` at or after `17eceeb`.
- [ ] Confirm the app opens without RedBox, warning overlay or the same warning repeating while navigating three screens.
- [ ] Keep tablet and Web out of scope.
- [ ] Prefer an isolated QA dataset. If using personal data, create and verify a backup first, then record how it will be restored.
- [ ] Set Android font scale to 1.0 for the first pass and 1.3 for the narrow-content pass.
- [ ] If a 320dp emulator is unavailable, use the largest Android display-size setting and record the device model, logical width and display setting. Treat it as a surrogate, not proof of 320dp.
- [ ] Enable TalkBack only for the dedicated accessibility pass.

## Minimum data states

Prepare only the states not already present on the device:

1. **Empty:** no body history and no active goal.
2. **Partial:** one weight entry or check-in with only some measurements; missing photos are intentional.
3. **Dense:** long history, outlier values, at least two monthly entries and two photos of the same pose.
4. **Long content:** long translated labels plus one increase goal and one decrease goal whose value/date exercise the full card width.

Do not corrupt SQLite to force an error state. Physical error/retry testing requires a deterministic fixture that does not exist yet. Until one is added, record this as **NOT PHYSICALLY VALIDATED** and cite `__tests__/quality/sprint-4-dense-data.test.ts` plus `__tests__/utils/screen-state.test.ts` as static evidence. The final result cannot be unconditional approval while this gap remains.

After QA, restore the original backup or delete the isolated QA dataset and verify the app reopens with the expected original data.

## Pass A — PT, light, font 1.0

### Bio tab

- [ ] Save today's weight with the keyboard action, change it, then save with the button.
- [ ] Leave and reopen Bio; confirm the saved value persists and rapid duplicate taps did not create duplicate history rows.
- [ ] Open the actual quick actions: Goals, Evolution, Analytics, Supplements and Weekly Report.
- [ ] Open monthly check-in from its separate card, enter partial measurements and select photos.
- [ ] Press Android Back: Discard must open; Cancel must preserve dirty input; Confirm must close and clear it.
- [ ] Reopen, save once with rapid duplicate taps, leave and reopen; confirm one persisted monthly entry and the selected photos.
- [ ] Cancel or deny photo permission once; the form must remain usable and must not show false success.
- [ ] Confirm the history empty/partial state is honest; absent values are not rendered as zero progress.

### Analytics

- [ ] Headline metrics show unit and time window.
- [ ] Weekly volume renders all 12 rows without horizontal clipping and remains reachable through normal vertical screen scrolling.
- [ ] Body-weight chart shows an overflow cue, scrolls horizontally and keeps Y-axis labels visible.
- [ ] Trend direction uses icon/text in addition to color.
- [ ] Strength Score and progress bars expose meaningful labels and values.
- [ ] Empty/insufficient sections do not fabricate a trend or score.

### Evolution

- [ ] Switch through Weight, Measurements, Photos and Analysis.
- [ ] Every graph shows current value, delta and unit without truncation.
- [ ] Horizontal charts visibly communicate overflow.
- [ ] Photo comparison uses matching front/front, back/back or side/side poses only.
- [ ] With two entries but no shared pose, Compare is hidden/disabled or explains why comparison is unavailable; it must not be an inert button.
- [ ] Android Back closes comparison before leaving the screen.

### Check-in

- [ ] Empty state CTA returns to the Bio check-in flow.
- [ ] Switch between Measurements and Photos.
- [ ] Gallery toggle state is visually and semantically clear.
- [ ] Select a previous month; date, photos, measurements and comparison content must all update together.
- [ ] Front/back/side tiles remain equal and labels are fully visible.
- [ ] Monthly comparison distinguishes missing data from a real zero.

### Goals

- [ ] Empty state is intentional and its creation CTA is fully visible and enabled.
- [ ] Existing cards show value, target date, current progress and status without fabricating progress from missing measurements.
- [ ] Progress direction is correct for one increase goal and one decrease goal already present in the QA dataset.
- [ ] Long values/date labels do not overlap actions or progress bars.

Goal creation/edit/delete validation belongs to Sprint 5. Do not use modal CRUD behavior as a Sprint 4 acceptance gate.

## Pass B — ES, dark, font 1.3 / largest display size

Run a focused pass rather than repeating every action:

- [ ] Bio quick-action labels remain fully visible; wrapping is allowed, clipped glyphs and hidden actions are not.
- [ ] Analytics metric labels, units, chart axes and Strength Score remain fully visible.
- [ ] Evolution tabs and current-value summaries leave every action visible and tappable.
- [ ] Check-in photo labels and comparison controls remain fully visible.
- [ ] Goals cards, dates, progress labels and CTA remain fully visible and tappable.
- [ ] No horizontal screen movement occurs except inside intentional chart/photo scrollers.
- [ ] Primary actions can be tapped reliably and do not overlap system insets or neighboring controls.
- [ ] Card text, muted text and chart lines remain distinguishable from their background in both required screenshots.

## TalkBack pass

- [ ] Bio quick actions announce destination and button role.
- [ ] Monthly check-in photo pickers announce pose and selected state.
- [ ] Analytics Strength Score and progress bars announce value/context, not just “progress bar”.
- [ ] Evolution segmented control announces selected tab.
- [ ] Check-in gallery toggle announces show/hide state.
- [ ] Goals cards and edit/delete controls announce goal context, action and button role.
- [ ] Focus order follows visual order; no focus trap remains after closing modal/dialog.

## Required approval captures

- [ ] Bio — light/PT normal.
- [ ] Analytics — dark/ES dense at font 1.3.
- [ ] Evolution — light/PT graph plus same-pose comparison.
- [ ] Check-in — dark/ES photos and measurements.
- [ ] Goals — light/PT empty plus dark/ES populated.

## Exit criteria

Record one result:

- **APPROVED:** every checkbox passes, including a future deterministic physical error/retry fixture.
- **CONDITIONALLY APPROVED:** the complete visual/device matrix passes, but error/retry remains explicitly `NOT PHYSICALLY VALIDATED` with the cited static evidence.
- **BLOCKED:** any crash, data-loss/false-success path, clipped critical action, inaccessible control or unreviewed required capture remains.

For either approval state:

- [ ] no crash, RedBox, silent loss or false-success path appeared;
- [ ] no critical action or text was clipped in the focused narrow/font-scale pass;
- [ ] charts retained labels, units and intentional overflow cues;
- [ ] empty, partial and unavailable data remained distinguishable;
- [ ] PT/light and ES/dark captures were approved;
- [ ] TalkBack had no blocker in the listed critical controls;
- [ ] the original dataset was restored and verified;
- [ ] the complete issue list and every approval capture were delivered before any runtime, dependency or documentation fix commit began.

After unconditional approval, dependency Batches 2–5 may start one at a time with their own Android verification. A conditional result requires an explicit Lucca decision before those batches begin. Sprint 5 implementation remains blocked until this checklist is signed off.

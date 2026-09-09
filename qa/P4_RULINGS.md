# P3 → P4 RULINGS — Sparkler Exit Lab (parent adjudication, 2026-09-09 01:20 EDT)

Reviewer grades: facts PASS (3 MINOR/2 NIT) · UX 8/10 · visual 8.3/10 · code 9/10. All PASS bars met. The following BINDING rulings adjudicate every finding for the P4 fix wave. Findings not listed here are recorded as accepted-as-is (cosmetic/info).

## R1 (BLOCKER-for-P4: mobile settings table) — VISUAL #MAJOR-mob
`#s2shoot` table fixed 640px in scroll wrapper: right ~270px cut at 390px viewport, no affordance.
**RULING: FIX.** Add under 520px: stacked-collapse of the settings table (each row → label/value/why stacked blocks). Keep the scroll wrapper for the SVG diagram only (it is a picture, scrollable is fine).

## R2 (BLOCKER-for-P4: dead head cards) — UX #4
`.headCard` click does nothing.
**RULING: FIX.** Clicking a head card must set `#headSelect` to that head (dispatch `change`), scroll to `#s4editor`, and give a 1-line toast "Heart selected — click a wand tip". Card cursor:pointer stays.

## R3 (HIGH: sample-load feedback + scroll alignment) — UX #1/#2/#6
"Open in lab" lands misaligned (toolbar below fold desk; canvas clipped 123px mob) + no visible feedback at click point; send-to-editor guard message lands out of sight.
**RULING: FIX (one mechanism).** (a) Add a shared toast element (bottom-center, gold border, 2.2s fade) used for: "Loading sample…", "Sample loaded — score 46", "Load a photo first", "Camera unavailable — pick a photo instead". (b) After sample load, scrollIntoView `#s4editor` toolbar with `block:'center'`-equivalent offset (scroll-mt on the editor section ~72px) so toolbar+canvas are both visible. (c) Add a small photo preview thumb into the lab results area (100px, shows the loaded image) — closes visual-audit MINOR too.

## R4 (HIGH: stale in-JS numbers) — FACTS #3/#4
analyze.js:414 "sparklers burn 30-60s" contradicts GT (1–5 min). analyze.js:411 "1-4s exposure" outside GT envelope.
**RULING: FIX.** (a) "30-60s" → "sparklers burn 1–5 min depending on size, so pre-compose before lighting". (b) "1-4s exposure" → "try a much slower shutter (below 1/15 s) or an ambient-only exposure". Re-verify both strings render in the Lab card.

## R5 (MEDIUM: undiscoverable gestures) — UX #3
Delete (dblclick/long-press) + Esc documented nowhere.
**RULING: FIX.** Extend editor hint line: "Click a wand tip to place · drag to move · corner handle to scale/rotate · double-tap (or long-press) a head to remove · Esc to deselect." One line, same element.

## R6 (MEDIUM: camera dead end) — UX #5
**RULING: FIX (cheap).** Keep the button; on failure show toast ONLY (no forced file-picker auto-open) — message says "Camera unavailable here — use Browse files instead." (Auto-forcing the picker reads as broken.)

## R7 (MEDIUM: license claim) — FACTS #2
"MIT licensed" with no LICENSE in repo.
**RULING: FIX.** Commit LICENSE (MIT, Copyright 2026 Caddy) + README before P5 deploy; keep footer claim once file exists.

## R8 (MEDIUM: unlinked source names) — FACTS #1
"I Love Sparklers" / "Twig & Vine" plain-text inside linked list.
**RULING: FIX (cheap).** Append "(verified via multiple sparkler-retailer guides)" parenthetical styling: keep names, add class s5srcname note "(offline verification)" — do NOT guess URLs.

## R9 (LOW batch: a11y + memory polish — apply all, they're small)
**RULING: FIX ALL.**
- editor.js:188: mirror `lastUrlLoaded` guard on the bitmap path (double baseSource rebuild).
- app.js:256: `window.__sparklerLab.imageBitmap?.close?.()` before overwrite.
- analyze.js:425: add `aria-live="polite"` to the score card container (set on #s2lab results wrapper).
- Hero stat chip text: "6 procedural heads" → "6 procedural heads + PNG upload" (kills NIT 5).
- FEC acronym: expand on first use in s2shoot ("flash exposure compensation (FEC)").
- Nav tap targets: raise nav link padding to min-height 44px on mobile via media query (cheap, closes UX #7 + visual MINOR).
- `.sample-open` inline font-family "Arial" → inherit system-ui (visual MINOR).
- Score numeral `.score-main`: bump to 30px tabular-nums (visual MINOR).

## R10 (NO-FIX, documented) — code LOWs #3/#4 (keyboard placement, roving tabindex)
Canvas pointer-only placement + role=toolbar roving-tabindex are real but heavy to retrofit; record as known limitations in README (keyboard users can still export/undo/toggle; placement is pointer/touch). Revisit post-launch.

## Re-verification requirements (P4 exit gate)
After fixes: re-run (a) mobile 390px screenshot of #s2shoot (stacked, no cut rows), (b) head-card click → headSelect changes + toast, (c) sample-load toast + aligned scroll, (d) in-JS rec strings contain "1–5 min" and no "30-60s"/"1-4s", (e) full console-clean journey, (f) curl LICENSE raw URL 200. Log all in QA_LOG.md with R-ids.
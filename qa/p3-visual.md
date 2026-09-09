# P3 Visual Audit — Sparkler Exit Lab

Reviewer: P3 visual auditor · 2026-09-09 · Site: http://127.0.0.1:8123/index.html
Viewports: 1440×900 desk, 768×1024 tab, 390×844 mob · Playwright Chromium 151 (node 1.62.1)
Evidence: 27 screenshots in `qa/shots/vis-*.png`; DOM readbacks in `qa/vis-*.log`
Reference tokens: SPEC.md — bg #0b0d12, panel #141824, text #e8e6df, muted #9aa0ae, gold #ffb347, flash-blue #7ec8ff, good #7ddf8e, bad #ff6b6b, radius 10px, 1px #232936 borders

## Grade: **8.3 / 10** — bar met (≥8)

## Coverage matrix

| Requirement | desk | tab | mob |
|---|---|---|---|
| hero fold | vis-hero-desk | vis-hero-tab | vis-hero-mob |
| explain section | vis-explain-desk | vis-explain-tab | vis-explain-mob |
| SVG diagram closeup | vis-diagram-desk | vis-diagram-tab | vis-diagram-mob |
| lab empty state | vis-lab-empty-desk | vis-lab-empty-tab | vis-lab-empty-mob |
| lab analyzed (sample-open) | vis-lab-analyzed-desk | vis-lab-analyzed-tab | vis-lab-analyzed-mob |
| head library | vis-heads-desk | vis-heads-tab | vis-heads-mob |
| editor 3 heads (couple-walk) | vis-editor-3heads-desk | — (desk req) | vis-editor-mob (1 head sanity) |
| before/after | vis-editor-beforeafter-desk | — | — |
| gallery | vis-gallery-desk | vis-gallery-tab | vis-gallery-mob |
| method | vis-method-desk | vis-method-tab | vis-method-mob |

## Findings (severity-tagged)

### Color discipline
- **[PASS]** Zero rainbow drift: only the 8 SPEC token colors appear across index.html + all engine JS (hex census: gold 44 uses, blue 6, good 2, bad 2, neutrals). Accent scan of computed styles: 44 elements gold, 6 blue, 0 anything else.
- **[PASS]** Blue reserved for flash semantics: flash arrows + couple markers in the curtain SVG, histogram clip zone, selected-layer handle. Gold carries accent duty (brand, CTAs, borders, sparkler heads).
- **[PASS]** Head thumbnails are gold-monochrome: mean lit-pixel RGB ≈ (253, 184, 80) on all 6 — consistent with #ffb347-family ember tones, no color mud.
- **[MINOR][mob]** Table `th` and `.s2-dot` use gold; on mobile the horizontal table strip keeps full gold borders, which reads slightly louder than other sections. Cosmetic only.

### Dark-theme contrast (WCAG-ish, token math)
- **[PASS]** text/bg 15.6:1, text/panel 14.2:1, muted/bg 7.4:1, muted/panel 6.8:1 (AA large + normal).
- **[PASS]** gold/panel 9.9:1, blue/panel 9.8:1, good/panel 10.8:1 — accents are luminous, never washed.
- **[PASS]** bad/panel 6.4:1 — the weakest pair still clears AA normal. No contrast failures found in any token pair.

### Typography hierarchy
- **[PASS]** Clean scale on desk: H1 64/750 → H2 27–28/700 → H3 16.8/700 → body 16/400 → secondary 14.4–15.2 → eyebrow 13/600. Steps are distinct; no size collisions between adjacent levels.
- **[PASS]** Mobile compresses correctly: H1 38px, H2 21.6px, body 16px — hierarchy preserved, no oversized overflow.
- **[MINOR]** `p.headProcedural` (14.4) vs `figcaption` (16/600) — two near-identical caption treatments inside one section; sub-level hierarchy is slightly soft.

### Visual hierarchy (problem → solution → tool)
- **[PASS]** Eye-flow works: hero states the problem ("Why sparkler tunnels vanish in flash photos") → CTA "Try the Lab" jumps straight to the tool (#s2lab), secondary "See how it works" → #s1explain. Explain section leads with the failure mode, then "Shoot it right" (solution), then Lab → Heads → Editor (tool), Gallery (proof), Method (honesty). Nav order mirrors this exactly (Explain/Shoot/Lab/Heads/Editor/Gallery/Method).
- **[PASS]** H1–H3 outline is strictly hierarchical — verified full outline (9×H2/H3 nests, no skipped levels).
- **[MINOR]** "6 procedural heads · 100% client-side · 0 uploads" proof chips render small on desk; they carry trust but get lost under the CTAs.

### SVG curtain diagram (s2shoot)
- **[PASS]** Two side-by-side panels, each labeled ("Front-curtain sync" / "Rear-curtain sync" 15px/600 text on panel bg) with per-panel subline ("flash fires at exposure start/end"), captions "sharp subject sits where the flash went off — at the very start/end".
- **[PASS]** Visual distinction is structural, not just color: front panel = flash bolt LEFT + sharp couple LEFT + gold trail leading right; rear panel = gold trail left + couple RIGHT + flash bolt RIGHT. Mirror-image geometry makes the timing difference readable without reading text. Gold = trail, blue = flash only — consistent with token semantics.
- **[PASS]** Renders 1009×319 desk (readable), 620×196 mobile inside `.s2-tablewrap`-style `overflow:auto` scroll wrapper — no squish, no clip.

### Consistency (spacing/radii/borders)
- **[PASS]** Border radii census across every section/panel/button/table/img/canvas/input/select: exactly one value in use — **10px**. Single-radius discipline holds site-wide.
- **[PASS]** Cards uniform: `.lab-card` etc. all panel bg + 1px #232936 border; sections share vertical rhythm; nav sticky bar uses same border token.
- **[MINOR]** `.sample-open` buttons carry an inline font-family "Arial" (fallback from a shorthand reset) — one inconsistent font on gold-bordered buttons vs system-ui everywhere else. Only cosmetic deviation found.

### Sample photos & gallery
- **[PASS]** All 4 gallery samples load (naturalWidth 1600). Aspect ratios exact: 1.500 natural vs 1.500 displayed at all 3 viewports — zero stretch/distortion. Flash-blown variant captioned ("the wands vanish — the exact problem this lab diagnoses") and labeled per A7.
- **[PASS]** Sample-open buttons pull samples into the lab: score 46/100, 3-component breakdown (Trail 25/40 · Ember 21/40 · Clip 0/20), ≥3 tailored recs rendered; histogram canvas 560×180 fully painted (litFrac 1.0).
- **[PASS]** EXIF card shows the honest "No EXIF data found" state for synthesized samples — correct per spec (samples ship no EXIF).
- **[MINOR]** After loading a sample, the lab itself shows no photo preview element (analysis cards + editor get the image, but the lab panel doesn't display what was loaded). Users can't visually confirm which sample is loaded without scrolling to the editor. UX papercut, not a defect against spec (spec defines dropzone/EXIF/histogram/score cards).

### Editor
- **[PASS]** Editor loads couple-walk at source res (base 1600×1067, canvas 988×659 display, never upscaled). 3 heads placed via pointer events land at exact fractional coords (0.30/0.28, 0.62/0.40, 0.80/0.22, size 0.12) — visible gold bursts on the couple-walk photo in vis-editor-3heads-desk.png. Before/after toggle shot captured. Mobile tap-place verified (1 head, vis-editor-mob.png).
- **[PASS]** Touch-action: none + pointer events on canvas; handles drawn per layer.

### Broken/overlap checks
- **[PASS]** No console errors or pageerrors at any viewport (only a benign canvas `willReadFrequently` perf hint).
- **[PASS]** Zero horizontal page scroll on mobile (scrollWidth−clientWidth = 0); desktop overflow list empty.
- **[PASS]** Tap targets ≥44px on all lab/hero buttons mobile (Browse 133×44, camera 133×44, Send-to-editor 167×44, hero CTAs 46px tall).
- **[MAJOR][mob]** `#s2shoot` settings table renders at fixed 640px width inside `overflow:auto` wrapper (table L21→R661 vs 390 viewport). No page-level horizontal scroll leaks (wrapper contains it), and it's the standard scrollable-table pattern, but the right ~270px of every row requires horizontal scrolling — settings rows are half-cut at first paint on 390px. Same wrapper handles the SVG diagram (620px wide).
  - *Suggested fix:* collapse table to stacked definition rows under 520px, or add a visible scroll affordance (gradient fade/cut-off edge + "swipe" hint).
- **[MINOR][mob]** Small tap targets in nav (a.brand 158×24, links 24px tall) and footer link rows (16–19px tall) — under 44px guidance; nav is sticky so mis-taps are cheap, but footer source links are genuinely tight.
- **[MINOR]** Score numerals (`.score-main`) are 16px body weight — the single most important number on the page reads with the same weight as body copy; a 28–32px tabular-nums display would lift the lab card.

## Verdict
Design tokens are applied with unusual discipline: one radius everywhere, two accent colors with strict role separation, all contrast pairs passing AA, typography scale coherent at 3 viewports, and no console errors. The two real deductions are mobile-only: the fixed-width settings table (MAJOR, scroll-cut rows) and sub-44px nav/footer tap targets (MINOR). The missing lab photo preview (MINOR) is the only desktop-visible papercut. Nothing overlaps, nothing stretches, nothing renders broken.

**8.3/10 — pass P3 visual bar.**
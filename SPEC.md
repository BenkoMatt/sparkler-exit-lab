# SPEC — Sparkler Exit Lab (v1.0, P0-locked 2026-09-08)

## Mission (from MASTER_PROMPT §1)
Static site that: explains flash-vs-sparkler photography; takes photos (upload + camera); examines them (EXIF, histogram, visibility score); overlays customizable sparkler heads; ships a demo gallery of synthesized samples.

## Site architecture (assembled index.html = shell + fragments)
Shell (`site/index.html`, built by assembler): dark night theme, sticky nav (Explain / Shoot / Lab / Heads / Editor / Gallery / Method), footer w/ MIT + sources. Fragments in `site/sections/`:
- `s1-hero.html` — #s1hero: title "Sparkler Exit Lab", subtitle, 2 CTA buttons (Try the Lab → #s2lab anchor; See how it works → #s1explain), inline SVG sparkler motif
- `s2-explain.html` — #s1explain: "Why sparklers vanish in flash photos" — flash vs ambient exposure, frozen embers; #s2shoot: settings table (per GROUND_TRUTH.md F1–F4) + rear-curtain diagram (inline SVG, no assets)
- `s3-lab.html` — #s2lab: photo lab — dropzone (drag/drop + picker + camera button), EXIF card, histogram canvas, visibility score + breakdown + ≥3 recommendations, "use in editor" button
- `s4-heads.html` — #s3heads: head library grid (6 procedural heads, canvas thumbnails, click → jumps to editor with that head)
- `s5-editor.html` — #s4editor: editor — canvas stage, place/transform (move/scale/rotate) heads, blend (screen/lighten/normal), glow bloom, color tint, opacity, flicker toggle, before/after slider, undo/redo, export PNG, localStorage restore
- `s6-gallery.html` — #s5gallery: demo gallery — 4 synthesized samples (incl. one flash-blown) with captions + "open in lab"
- `s7-method.html` — #s5method: Method & limitations — client-side JS heuristic, no cloud/AI, honest limits

## Engine modules (site/assets/js/, plain ES2020 modules, no build step)
- `synth.js` — sample-photo generator (PIL-built at deploy; fixed seed; dark scene, bokeh, silhouettes, wand streaks; flash-blown variant) → site/assets/img/*.jpg
- `exif.js` — EXIF parse: shutter, ISO, aperture, Flash-fired flag (subdir-scoped; no globals)
- `analyze.js` — luminance histogram, bright-spot/trail detection, 0–100 score = trail(40) + ember(40) + clip(−0–20 penalty), ≥3 tailored recommendations
- `heads.js` — procedural head generator: 6 heads (classic burst, heart, star, initials, flame-tip, glitter orb), glow sprites, flicker; PNG upload support
- `editor.js` — layered canvas, touch+mouse handles, blend/glow/tint/flicker, before/after, undo/redo (stack ≤50), export at source resolution, localStorage
- `app.js` — wiring, camera (getUserMedia + fallback), sample loading, nav
- `vendor/exifreader.min.js` — IF vendored; else exif.js hand-rolled (decision: hand-roll minimal parser, avoid 3rd-party license file)

## Design tokens
- bg #0b0d12, panel #141824, text #e8e6df, muted #9aa0ae, accent #ffb347 (sparkler gold), accent2 #7ec8ff (flash blue), good #7ddf8e, warn #ffb347, bad #ff6b6b
- font: system-ui stack; radii 10px; cards: panel bg + 1px #232936 border
- vars with fallbacks everywhere; one meaning per color

## Acceptance gates (every one verified w/ Playwright + logged in QA_LOG.md)
A1 upload jpeg/png/webp + drag-drop + picker; HEIC notice (canvas decode check)
A2 camera getUserMedia on HTTPS; fallback to picker on deny/unsupported
A3 EXIF card (or honest "no EXIF"); histogram renders; score + 3-component breakdown; ≥3 tailored recs
A4 editor: click wand tip → head placed; handles mouse+touch; blend/glow/tint/flicker visibly change render; before/after; export PNG at source resolution (assert download); localStorage restore after reload
A5 head library: 6 heads render at editor scale; PNG upload w/ transparency preserved
A6 guide numbers match GROUND_TRUTH.md exactly (burn times, spacing, ISO/aperture/FEC ranges)
A7 gallery: 4 samples load; flash-blown variant labeled; "open in lab" works
A8 method section present; no claims of AI/cloud analysis; limitations listed

## Visual QA battery (at every milestone; see MASTER_PROMPT §5)
- Playwright screenshots: 1440×900, 768×1024, 390×844 (per state: hero/lab/editor/before-after)
- DOM probes: section ids, h1–h3 hierarchy, key strings, comment-stripped tag balance, banned strings
- Console-error capture (CDP), asset budget <3 MB, tap targets ≥44px mobile
- QA_LOG.md append-only: ts, viewport, file, md5, PASS/FAIL + evidence
- 429/timeout discipline per subagent-reliability; disk truth beats banners

## Orchestration
- P1 wave: 7 drafter children (s1–s7 fragments) → assembler merges → visual gate → commit
- P2 wave: engine children (a)–(e), each w/ milestone screenshot gate → commit
- P3: 4 reviewers (fact/UX/visual/code) from disk, numeric bars
- P4: fixer wave (arbitration-first) → re-run failed gates → commit
- P5: assemble final → battery → deploy (gh api pages) → live curl + screenshot → contact sheet
- PROJECT_STATE.md updated after every wave. Watchdog cron every 30m → removed at DoD.

## DoD (from MASTER_PROMPT §8)
Live URL 200 + screenshot; all A1–A8 verified; contact sheet + ::preview in chat; delivery report (rulings, rejections, could-not-verify); README+LICENSE (MIT); Caddy commits; watchdog removed.
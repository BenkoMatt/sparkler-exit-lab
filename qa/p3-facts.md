# P3 Fact-Check — Sparkler Exit Lab (adversarial)

Reviewed: `GROUND_TRUTH.md` (law, P0) · `site/index.html` (1099 lines, full read) ·
`site/assets/js/{app,analyze,editor,exif,heads}.js` (network audit + constants) ·
`site/tools/synth.py` (sample generators) · 8 source links via `curl -sI` (2026-09-09).

---

## A. Photographic numbers vs GROUND_TRUTH

| # | Page claim (quoted) | Ground truth | Verdict |
|---|---|---|---|
| 1 | Shutter drag `1/15–1/60 s` (s2shoot, line 764) | F2: ≈1/15–1/60 s typical | ✅ EXACT |
| 2 | Aperture `f/1.4–2.8` (line 765) | F2: f/1.4–2.8 for exits | ✅ EXACT |
| 3 | ISO `800–1600` (line 766) | F2: ISO 800–1600 (Davidson 800–1000) | ✅ EXACT |
| 4 | FEC `−2/3 to −1 2/3 stops` (line 767) | F2: ≈ −2/3 to −1⅔ | ✅ EXACT |
| 5 | 20-in burn `≈2 min; plan for 1–2` (line 774) | F3: use "≈2 min; plan for 1–2" | ✅ EXACT |
| 6 | 36-in burn `≈4 min; plan for 3–5` (line 775) | F3: use "≈4 min; plan for 3–5" | ✅ EXACT |
| 7 | Tunnel spacing `4–6 ft apart` (line 776 + s5method line 1086) | F4: 4–6 ft (master-prompt 3–4 corrected) | ✅ EXACT |
| 8 | Rear-curtain: flash fires at `END` of exposure, trails trail `BEHIND` the sharp subject (line 763) | F2: same semantics | ✅ EXACT |
| 9 | Flash duration `~1/1000 s or faster` freezes embers as tiny points (line 747) | F1: ~1/1000s+ freezes ember bursts | ✅ match |
| 10 | "Sparkler brightness … depends on ISO and aperture, not shutter speed" (line 748) | F1 (Printique/Adorama) | ✅ match |
| 11 | "Fast shutter + front-curtain flash = no trails at all" (line 749) | F1 bullet 3 | ✅ match |
| 12 | "TTL / Auto flash overpowers the scene" (line 746) | F1 (Rangefinder) | ✅ match |
| 13 | Wand hold "held up, angled slightly toward center" (line 777) | F4 (Comfy Pixel) | ✅ match |
| 14 | Ops facts labeled "planning guidance, not measurements" (line 822) | F5 requires this label | ✅ present |

**Zero numeric drift on the page copy.** Every GT figure appears verbatim; no stale
master-prompt figures (90 s burn, 3–4 ft spacing) survived into the page.

## B. How-the-analysis-works claims vs actual JS

- Grep of all five modules for `fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource`:
  exactly **2** fetch call sites, both fetching relative sample JPGs:
  - `app.js:512 fetch(url)` — url is always `SAMPLE_DIR('assets/img/') + 'sample-*.jpg'` (app.js:10).
  - `editor.js:657 fetch(url)` — url is `'assets/img/sample-' + name + '.jpg'` resolved
    against `document.baseURI` (editor.js:654–655) — same-origin relative only.
- `grep -rn "https\?://" site/assets/js/` → **zero absolute URLs** (exit 1).
- No `<form>`, no `action=`, no `navigator.sendBeacon`, single script tag
  (`assets/js/app.js`, relative). All dynamic `import()`s are relative (`./exif.js`,
  `./editor.js`, `./analyze.js`, `./heads.js`); all `img.src` assignments receive data
  URLs, blob URLs, or local sample paths.
- "Nothing is uploaded" / "no server, no accounts" / "no AI or cloud vision" (line 1063)
  → confirmed by code: analysis is union-find connected components + histogram on
  `ImageData` in-browser (analyze.js:142–290); EXIF parsed locally (exif.js).
- 4. Hero stat strip: "6 procedural heads" — `HEAD_KINDS = ['classic','heart','star',
  'initials','flame','orb','upload']` (heads.js:10) = 6 drawn heads + an upload slot;
  gallery/editor copy says the same. Accurate as worded.
- 5. "100% client-side", "0 uploads" — accurate (evidence above).
- 5. Gallery honesty: intro "Procedurally synthesized samples – not real weddings"
  (line 1027) + "All sample imagery is generated code" (line 1050); flash-blown card
  is explicitly labeled as the failure mode ("Front-curtain flash: the wands vanish
  – the exact problem this lab diagnoses"). Verified against `synth.py`
  `make_flash_blown()`: flat lifted background, frozen 4px ember dots, no streaks —
  generator matches the caption. All four sample JPGs are dark night scenes
  (mean luma 15–52), consistent with captions.

## C. Source links in s7-method (curl -sI)

| Link | HTTP | Note |
|---|---|---|
| rangefinderonline.com/…/8-tips-and-techniques… | 200 | |
| digitalcameraworld.com/…/cheat-sheet-rear-curtain-flash… | 200 | |
| slrlounge.com/wedding-reception-shutter-drag-shot/ | 301 | → `/glossary/shutter-drag-definition/` → 200 |
| mark-davidson.com/how-to-photograph-wedding-sparkler-exit/ | 200 | |
| printique.com/blog/sparkler-photography-5-tips/ | 200 | |
| sparklers.us/blog/how-long-do-different-wedding-sparklers-burn/ | 301 | → `/blogs/news/…` → 200 |
| grandweddingexit.com/blogs/wedding-sparkler-ideas/wedding-exit-with-sparklers | 200 | |
| comfypixel.com/wedding-sparkler-exit-photos-how-to-capture-the-perfect-shot/ | 200 | |

All 8 resolve to real content; the two 301s land on sensible equivalents, not a
soft-404 home page. **However**, the page credits two sources by name with **no link at
all**: "I Love Sparklers" (line 1085, burn times) and "Twig & Vine" (line 1086,
spacing). GROUND_TRUTH F3/F4 lists these as verified sources, so the credit is honest,
but the copy pattern ("A, B, and I Love Sparklers") invites the reader to assume all
three are links. Same for the two-name mentions in the spacing row.

## Findings (severity-tagged)

1. **MINOR** — Unlinked source names read as links. Quote: *"Sparkler burn times:
   <a …>Sparklers.US</a>, <a …>Grand Wedding Exit</a>, and <span
   class="s5srcname">I Love Sparklers</span>"* and *"…<a …>Comfy Pixel</a> and
   <span class="s5srcname">Twig &amp; Vine</span>"* (index.html:1085, 1086).
   Problem: two plain-text names inside otherwise all-linked list items look like
   broken/lazy links; a fact-checker reading only linked sources would find the burn-time
   and spacing claims under-sourced. Fix: either add their URLs (find during P0 research)
   or make the unlinked status explicit, e.g. `(also verified offline: I Love Sparklers)`.

2. **MINOR** — Footer license claim unverifiable. Quote: *"MIT licensed · <a
   href="https://github.com/BenkoMatt/sparkler-exit-lab" …>source on GitHub</a>"*
   (index.html:1095). The repo exists (HTTP 200) but GitHub's license API returns 404 —
   no LICENSE file detected in the repo. Fix: commit a LICENSE file to the repo, or drop
   "MIT licensed" until it exists. (Repo link is outside the 8 source links and resolves.)

3. **MINOR** — Recommendation string contradicts page copy. Quote: *"shoot several
   frames quickly - sparklers burn 30-60s, so pre-compose before lighting"*
   (analyze.js:414, shown in the Lab's "What this means" card). GROUND_TRUTH F3: 20-inch
   ≈2 min (plan 1–2), 36-inch ≈4 min (plan 3–5); the page's own s2shoot section says
   exactly that. "30–60s" appears nowhere in GT. Fix: change to
   "sparklers burn 1–5 min depending on size, so pre-compose before lighting" (or drop
   the number). This is in-JS copy, so it is a content drift even though index.html is clean.

4. **NIT** — Recommendation string outside the verified envelope. Quote: *"no trails
   detected - try a 1-4s exposure and move the sparkler while the shutter is open"*
   (analyze.js:411). GT F2 says shutter drag ≈1/15–1/60 s; "1–4 s" is a different (much
   slower) exposure class that GT does not sanction. It is plausibly good advice for
   ambient-only shots, but it is not a GT-traceable number. Fix: say "try a much slower
   shutter (well below 1/15 s) or ambient-only exposure" — or add the 1–4 s figure to GT
   with sources.

5. **NIT** — "6 procedural heads" vs the 7th list entry. Quote: *"6 procedural heads"*
   (index.html:688) vs `HEAD_KINDS = ['classic', 'heart', 'star', 'initials', 'flame',
   'orb', 'upload']` (heads.js:10). The 7th kind is the uploaded-PNG slot, not a
   procedural head, and the page separately says "PNG uploads are supported … for custom
   heads", so the count is defensible — but only because "procedural" is doing the work.
   Fix (optional): "6 procedural heads + PNG upload" removes all ambiguity.

## Non-findings (checked, clean)

- Hero stats: 6 heads (see NIT 5), 100% client-side ✅, 0 uploads ✅.
- No network calls except same-origin sample fetches; no tracking pixels; no fonts/CDN.
- Gallery captions match `synth.py` generators; flash-blown labeled honestly; all four
  samples are real synthesized JPEGs on disk (verified, dark scenes, not stolen photos).
- All GT numbers on the page match verbatim (table in section A).
- Rear-curtain semantics in the SVG diagram (line 783, 802, 814) match F2 exactly.

---

**Verdict: PASS (with 3 MINOR + 2 NIT).**
The photographic copy is numerically exact against GROUND_TRUTH; the privacy claims are
backed by a clean network audit; all 8 source links resolve. The MINORs are polish-level
(unlinked source names, unverified MIT claim, one stale in-JS number) and none
contradict a verified fact on the main page copy.
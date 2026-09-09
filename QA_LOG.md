# QA_LOG — Sparkler Exit Lab (append-only)
| ts (EDT) | gate | viewport/artifact | file + md5 | result | evidence |
|---|---|---|---|---|---|
| 09-08 23:47 | GT-verify | 8 searches | GROUND_TRUTH.md | PASS | every fact ≥2 independent sources; 2 deltas corrected (burn times, spacing) |
| 09-08 23:55 | P0-spec | - | SPEC.md 5261B / GROUND_TRUTH.md / PROJECT_STATE.md | PASS | all contracts enumerated A1–A8 |
| 09-08 23:56 | P0-commit | - | git 8b49737 | PASS | commit + repo created (github.com/BenkoMatt/sparkler-exit-lab) |
| 09-08 23:58 | watchdog | cron 7263f23e6008 | every 30m, deliver=local | PASS | created + next_run 00:17 verified |
| 09-09 00:20 | P2a-synth | programmatic | 4 samples (43K/19K/75K/39K bytes) | PASS | flash-blown flat+bright (mean 52, std 8) vs tunnel-drag textured (mean 27, std 29); heart region 2.6% bright px; contact sheet qa/synth_contact_v1.jpg |
| 09-09 00:28 | P1-structural | 7 fragments | s1 6519B s2 11536B s3 6164B s4 3940B s5 7847B s6 4471B s7 5232B | PASS | no scripts/external assets/lorem; tags balanced (SVG self-closing legal); all contract ids present; s2 numbers match GROUND_TRUTH (en-dash variants) |
| 09-09 00:35 | P1-assemble | programmatic | index.html 48397B, 7 fragments merged | PASS | tag balance clean (HTMLParser), 8/8 section ids, h1=1 h2=7 |
| 09-09 00:36 | P1-visual | 1440x900 / 768x1024 / 390x844 | p1-shell-*.png (120K/108K/51K) | PASS | all sections render, DOM probes 7/7 (title/lab/editor/heads/gallery/method/rear-curtain) |
| 09-09 00:52 | P2-intake | Playwright HTTP (http.server 8123) | exif.js 9.4K + app.js 19K | PASS | file:// CORS noted -> HTTP harness; 15+28 assertions by child; end-to-end sample load OK |
| 09-09 00:52 | P2-analyze | Playwright | analyze.js 18.3K | PASS | 22/22 child checks; real-page: tunnel-drag 46pts(6 trails) vs flash-blown 0 - discriminates; perf 20-55ms |
| 09-09 00:53 | P2-heads | headless Chrome 800x600 | heads.js 17.6K, preview md5 3556bdf8d4d4b3886d1463a767de1918 | PASS | all 6 kinds lit with hot cores |
| 09-09 00:58 | P2-editor | Playwright | editor.js 25K | PASS-AfterFix | 2 integration bugs fixed by parent: (1) sample name->file mapping + eager editor import in app.js; (2) undo double-push on placement (pushedByAdd). 3 heads place/move/undo/redo verified |
| 09-09 00:59 | P2-e2e | Playwright | export-test.png 184KB download 'sparkler-exit-lab.png' | PASS | full path: sample->analyze->place 3 heads->undo/redo->export at source res; zero console errors |
| 09-09 01:1x | P4-R1 | Playwright 390px + computed styles | shots/p4-mobile-s2shoot-stacked.png, p4-mobile-s2shoot-stacked-full.png | PASS | table display:block, thead hidden, 6 stacked cards, zero overflow-cut (tableW=wrapW=350); SVG diagram kept overflow-x:auto |
| 09-09 01:1x | P4-R2 | Playwright click + DOM asserts | shots/p4-headcard-click-toast.png | PASS | headSelect classic→heart/initials, change dispatched, toast "HEAD selected - click a wand tip", #s4editor lands at 72px scroll-margin |
| 09-09 01:1x | P4-R3 | Playwright + MutationObserver | shots/p4-sample-load-toast-scroll.png, p4-mobile-sample-load-scroll.png | PASS | toasts: Loading sample…/Sample loaded — score 46/Load a photo first/Camera unavailable; toolbar+canvas in view desk (2..831 < 900) and mob (158..906 < 844); 100px thumb in lab results |
| 09-09 01:1x | P4-R4 | grep + live #recList assert | shots/p4-lab-card-recs.png | PASS | "1-5 min" renders in card; "30-60s"/"1-4s" absent from analyze.js |
| 09-09 01:1x | P4-R5 | Playwright hint assert + gestures | shots/p4-editor-head-placed.png | PASS | hint line lists double-tap/long-press + Esc; Esc deselect PASS, dblclick delete PASS |
| 09-09 01:1x | P4-R6 | Playwright getUserMedia rejection | shots/p4-camera-toast.png | PASS | toast only, fileInput auto-open count = 0 |
| 09-09 01:1x | P4-R7 | curl /LICENSE 200 | site/LICENSE, site/README.md | PASS | MIT (c) 2026 Caddy; README covers method/limitations/credits |
| 09-09 01:1x | P4-R8 | grep s5srcname | sections/s7-method.html | PASS | "(verified via multiple sparkler-retailer guides; offline verification)" appended, no URLs guessed |
| 09-09 01:1x | P4-R9 | Playwright computed styles | QA run phase3 | PASS | a) bitmap guard lastBitmapLoaded; b) prevBitmap.close() before overwrite; c) lab-results aria-live=polite; d) hero chip "+ PNG upload"; e) FEC expanded; f) nav min-height 44px mobile; g) .sample-open font-family inherit; h) .score-main 30px tabular-nums |
| 09-09 01:1x | P4-gate-e | Playwright full journey | shots/p4-export-download.png 449KB | PASS | load file→place head→esc/dblclick→undo→export→4 samples (46/0/46/26), zero console errors |
| 09-09 01:42 | P4-exitgate | parent spot-check | 9 p4-*.png shots + file greps | PASS | R4 strings fixed; toast.js wired; LICENSE+README on disk; hero chip + FEC expansion verified; budget 0.37MB/3MB |
| 09-09 04:52 | P5-finalbattery | Playwright local + LIVE | final-*.png + live-*.png | PASS | post-P4 build: head-card flow heart->1 layer, export 553KB, console clean |
| 09-09 04:52 | P5-deploy | live URL | pages build 200, commit eb640ef | PASS | 404 root cause: qa/ artifacts 13MB + site in subdir; fixed (gitignore qa/, site->root) |
| 09-09 04:55 | P6-liveverify | live https | live-editor-1440.png + live-mobile-390.png | PASS | live journey: sample 46pts/6 trails, head card->heart placed, export 553KB download, 8/8 sections, console clean |

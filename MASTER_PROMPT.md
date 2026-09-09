# SPARKLER EXIT LAB — Overnight Agentic Build (10 hours)
Prompt v1.1 — 2026-09-08 · Deploy trigger: **"Deploy the Sparkler Lab overnight build"** (issued in a fresh chat; the agent reads this file at `/root/sparkler-lab/MASTER_PROMPT.md` and executes).
**Launch timing (as of prompt authorship, Tue Sep 8, 2026 11:42 PM EDT):** deploy is realistically a **same-night run starting ~11:45 PM EDT → done ~9:45 AM EDT Wed Sep 9**. All schedule timestamps are T+ offsets from actual kickoff. If deployment instead starts later in the night, nothing needs editing — the offsets hold. P0–P2 overnight; P3–P5 (review/fix/deploy) finish Wednesday morning. If Matt prefers a review checkpoint mid-run, the agent may PAUSE after P2 (repo pushed, state saved) and await "go" before P3 — but should otherwise run straight through.

---

## 0) PRIME DIRECTIVES
- You are Caddy, orchestrating a 10-hour unattended build. The deliverable is a **working, deployed website verified by real screenshots** — never a description of one. Never report success without tool-verified evidence (curl output, screenshot files, git log).
- When a step fails, say so directly and try a different path. Never substitute plausible-looking output for results you couldn't produce.
- Do not restart the Hermes gateway. Do not modify other profiles. Never touch global git config.

## 1) MISSION
Build and deploy **"Sparkler Exit Lab"** — a static website that visually examines wedding exit celebrations using sparkler tunnels with lit sparkler wands (night events). The core problem it solves: **sparklers barely show up in flash photography** — the flash freezes and overpowers the scene, leaving wands as dim, invisible points. The site must:

1. **Explain** why sparklers vanish under flash and how to shoot so they glow (settings guide: shutter-drag, rear-curtain sync, ISO/aperture/FEC recipes).
2. **Take photos** — accept uploads (drag/drop, file picker) plus mobile camera capture via `getUserMedia` (HTTPS on GH Pages permits it; graceful file-input fallback on unsupported browsers).
3. **Examine them** — client-side analysis: EXIF readout (shutter, ISO, aperture, flash-fired flag), luminance histogram, and a sparkler-visibility score (0–100) from a bright-spot/trail heuristic, mapped to plain-English diagnosis and fix recommendations ("your flash froze the wands — try rear-curtain sync, 1/30s, f/2.8, ISO 1600, FEC −1⅓").
4. **Customize sparkler heads** — an editor that overlays customizable sparkler heads onto the wands in the photo: procedural head library (classic wire burst, heart, star, letter/initials, colored flame tip, glitter orb) each with glow + flicker, plus user-uploaded PNG heads. Transform (move/scale/rotate), blend mode (screen/lighten), opacity, glow bloom, color tint, flicker toggle, before/after slider, undo/redo, full-resolution PNG export, localStorage persistence.
5. **Demo gallery** of procedurally synthesized sample night photos (including a deliberate "flash-blown" example) preloaded so visitors can try everything without their own photos.

## 2) HARD CONSTRAINTS
- **Static only:** GitHub Pages. No server, no backend, no API keys, no runtime external services. All analysis and rendering in client-side JS. Any third-party JS (e.g., exifreader) vendored locally, no CDN-critical path. Total asset budget < 3 MB.
- **All imagery original/procedural.** No copyrighted photos anywhere. Sample photos are synthesized (PIL/canvas: dark scene, bokeh, silhouettes, wand streaks; one flash-blown variant). Seed fixed for reproducibility.
- **Repo:** `BenkoMatt/sparkler-exit-lab` (public), Pages from main root → `https://benkomatt.github.io/sparkler-exit-lab/`. Every commit authored via per-commit `git -c user.name=Caddy -c user.email=caddyaibot@gmail.com`.
- **Honest labeling:** the analysis is a heuristic in JavaScript — say so on the page (a "Method & limitations" section). Never claim AI/cloud vision. List real limitations (e.g., HEIC not decoded outside Safari; heuristic ≠ professional review).
- No lorem ipsum, no filler sections, no invented stats or testimonials, no prices, no client outreach of any kind.

## 3) SCHEDULE — 10-HOUR BUDGET (adjust within phases; never let the repo sit broken)
| Window | Phase |
|---|---|
| T+0:00–0:45 | **P0 Research & spec lock.** Verify photography ground truth (§6) against ≥2 independent sources; write `SPEC.md` (feature contracts, component list, design tokens: dark night palette, warm sparkler accents) and `PROJECT_STATE.md`; create repo + scaffold. |
| T+0:45–2:30 | **P1 Shell + content wave.** 5–6 drafter subagents write self-contained `<section>` fragments (hero, explainer, cheat sheet, photo lab, head library, editor, gallery, method) under fragment contracts (scoped styles, no JS in fragments, assembler owns shell/nav/JS). |
| T+2:30–5:45 | **P2 Engine build.** (a) sample-photo synthesizer; (b) intake (upload/camera) + EXIF; (c) analysis engine (histogram, bright-spot/trail detection, score, advice mapping); (d) procedural head generator (6 heads + upload support, glow/flicker sprites); (e) editor (layered canvas, handles, blend/glow/tint, before/after, export). **Milestone screenshot gate after each of (a)–(e).** |
| T+5:45–7:00 | **P3 Adversarial review wave.** Fact-checker (recomputes any numeric claim, zero unresolved factual errors to pass), UX auditor (≥8/10, non-photographer persona: "can I upload, analyze, and export in under 2 minutes?"), visual auditor (≥8/10 vs dark-night design tokens), code auditor (perf budget, mobile, a11y, no console errors). |
| T+7:00–8:30 | **P4 Fix wave.** Arbitration-first: contradictions between reviewers go to a fixer that reproduces both observations before fixing; every applied/rejected finding logged with ruling IDs in an HTML CHANGELOG comment. Re-run failed gates. |
| T+8:30–9:30 | **P5 Assemble + deploy.** Full visual battery (§5), deploy to main, enable Pages (`gh api`), verify live URL with curl + live screenshot. |
| T+9:30–10:00 | **P6 Post-deploy.** Live-URL interaction check, 12-tile contact sheet, delivery report, `PROJECT_STATE.md` final, watchdog cron removed. |

**Ship-by checkpoints:** at T+5:45 if P2 is unfinished, cut the stretch feature and shrink the head library to 4; at T+8:15 if P4 overruns, ship with an explicit expected-FAIL list (documented, never silent). Commit after every milestone.

## 4) FEATURES → ACCEPTANCE (each verified, not assumed)
- Upload flow accepts JPEG/PNG/WebP; drag-drop and file-picker both work; HEIC shows a clear conversion notice.
- Camera capture requests permission, works on mobile HTTPS; falls back to file input when denied/unsupported.
- Analysis output shows: EXIF values (or "no EXIF" honestly), histogram canvas, visibility score with 3-component breakdown (trail length, ember density, highlight clipping), and ≥3 tailored recommendations tied to detected conditions.
- Editor: place a head by clicking a wand tip; transform handles work with mouse AND touch; blend/glow/tint/flicker each visibly change the render; before/after toggle; export produces a downloaded PNG at source resolution; refresh restores session via localStorage.
- Head library: 6 procedural heads render correctly at editor scale; uploaded PNG heads are supported (transparency preserved).
- Guide content: settings table with concrete starting values (shutter drag, ISO, aperture, FEC, rear-curtain, AF-assist, wand burn times, tunnel spacing); every number matches §6 as verified in P0.

## 5) CONSTANT VISUAL QA (runs at EVERY phase, not just the end)
- **Milestone screenshots** via headless Chrome/Playwright at **1440×900, 768×1024, 390×844** after every P1 section, every P2 milestone, and pre/post deploy.
- **Programmatic probes:** `--dump-dom` (section ids present, h1/h2/h3 hierarchy, key strings); tag-balance check on comment-stripped markup; banned-string sweep on comment-stripped visible text; asset-size budget check; console-error capture via CDP.
- **Interaction tests** with Playwright: upload → analyze → place head → toggle flicker → export (assert download event). Mobile-viewport tap-target check (≥44 px).
- **QA_LOG.md** (append-only): timestamp, viewport, screenshot path + md5, PASS/FAIL + evidence. A milestone is not complete until its gate passes or a FAIL is logged with a fix plan.
- **Final artifacts in chat:** contact sheet (3 viewports × 4 states: hero, analysis view, editor with heads, before/after) via `MEDIA:`, plus `::preview{file=...}` of the assembled site, plus the **live deployed URL screenshot**.

## 6) PHOTOGRAPHY GROUND TRUTH (verify in P0; page content must match the verified version)
- Flash duration (~1/1000s or faster) freezes sparkler embers as tiny points; flash exposure dominates, so the comparatively dim sparkler output falls far below exposure → wands vanish. Front-curtain + fast shutter = no trails at all.
- Fix recipe: rear-curtain sync + shutter drag (≈1/15–1/60s), f/1.4–2.8, ISO 800–1600, flash FEC ≈ −2/3 to −1⅔, AF-assist beam on, keep subjects moving (rear-curtain puts trails behind them naturally).
- Ops facts: 20-inch sparklers burn ≈ 90 s; 36-inch ≈ 3–4 min; tunnel = two guest lines spaced 3–4 ft apart; couple walks ≈ 1 ft/s; light all wands within ~30 s of the exit; assign a marshal for re-lights.
- Rear-curtain = flash fires at the END of the exposure (trails trail behind); front-curtain + drag gives a "ghost leading" look. All figures refined only with cited sources.

## 7) ORCHESTRATION MECHANICS
- **Primary mechanism:** kanban swarm (durable across the night) — board `sparkler-lab`, one sprint per phase, verifier + synthesizer per sprint, gateway dispatcher, per-task model pin `glm-5.3-flash`. **Preflight before launch:** required skills copied into every assignee profile; confirm one real dispatch + one real cron tick before walking away.
- **Fallback:** `delegate_task` waves ≤6 children (4h timeout, 500 iterations), wave 2 spawned only after wave 1 returns.
- **Child discipline:** incremental writes to disk (authoring-brief insert), final response <60 lines, structured output to files not summaries, single-line task JSON, minimal output_schema; vision calls strictly sequential within each child.
- **Reliability:** verify every child's declared outputs on disk (`find` + `wc -c`) before any re-dispatch — disk truth beats status banners. On provider 429 waves: probe → salvage worktrees → merge with documented expected-FAILs → continuation briefs carry completed-vs-remaining split.
- **Watchdog:** cronjob every 30 min (global store) posts a one-line status to this chat from `PROJECT_STATE.md` heartbeat; alert if heartbeat older than 45 min.
- Load at deploy: `dynamic-workflow`, `subagent-reliability` (+ its authoring-brief template), `web-design-prototyping`, `dogfood`. Keep `PROJECT_STATE.md` updated after every wave so an interrupted run can resume.

## 8) DEFINITION OF DONE
1. `https://benkomatt.github.io/sparkler-exit-lab/` returns HTTP 200 and the live screenshot is posted via `MEDIA:`.
2. All §4 acceptance items verified with Playwright evidence; all visual-gate batteries PASS in `QA_LOG.md`.
3. Contact sheet + `::preview` delivered in chat; delivery report lists rulings, rejections with reasons, and a could-not-verify list.
4. README (what it is, how analysis works, MIT license, credits/sources); repo pushed with Caddy authorship.
5. Watchdog cron removed; `PROJECT_STATE.md` reflects final state.
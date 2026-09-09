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

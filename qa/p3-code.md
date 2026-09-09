# P3 Code Audit — Sparkler Exit Lab (code auditor)

**Grade: 9 / 10** — Zero console messages (errors *and* warnings) across the full Playwright journey; EXIF parser passed 14/14 adversarial edge-case tests; no XSS surface; no listener leaks; budget 412KB/3MB. Deductions are LOW-severity polish items only.

Verification basis: all 5 modules read in full (app.js 540L, exif.js 257L, analyze.js 490L, heads.js 486L, editor.js 694L), assembled index.html (1099L) + all 7 fragments, node EXIF test harness (`qa/exif-edge-tests.mjs`, 15 cases), Playwright journey (`qa/p3-journey.mjs`) with all console/pageerror/requestfailed channels wired.

---

## 1. EXIF parser edge cases — PASS (verified by execution)

Harness: synthetic buffers + `parseExif`/`hasExif`/`formatShutter` imported directly in node 22. **14/14 PASS** (1 test failed on its own bad expected value; actual output `'1/125'` was correct).

| Case | Result | Guard location |
|---|---|---|
| 0/1/2/3-byte buffers | nulls, no throw | exif.js:92 (`byteLength < 4`), :93 (SOI check) |
| PNG header / random garbage ×32 | graceful `-1` path | exif.js:93, :96 |
| APP1 claims segLen 65535, 10 bytes present | rejected | exif.js:108 (`i + segLen > byteLength`) |
| APP1 "Exif\0\0" truncated TIFF / byte-order cut | nulls, no throw | exif.js:128 (`tiff + 8 > byteLength`) |
| Valid synthetic EXIF (rationals, LE) | decodes `1/125` correctly | exif.js:146-223 |
| Value offset past buffer | tag dropped, no throw | exif.js:174 (`pos + total > byteLength`) |
| Count bomb (999999) | rejected | exif.js:150 (`> 0x1000`), :164 (`> 0x10000`) |
| den=0 RATIONAL | null, not Infinity | exif.js:212 |
| formatShutter matrix | all 8 values exact | exif.js:234-251 |

Malformed payload path emits `console.warn` (exif.js:80-82) but never throws. **No findings.**

## 2. XSS — PASS

Grep across all JS + fragments + index.html: **zero** occurrences of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, inline `on*=` handlers. Every dynamic string insertion uses `textContent`/`createElement`:
- File name → `app.js:188` (`fn.textContent = fileName`)
- EXIF values → `app.js:208-215` (`dt/dd.textContent`)
- Recommendations → `analyze.js:434-441` (`li.textContent`)
- Editor localStorage restore is schema-sanitized before use (`editor.js:605-620`), never rendered as HTML.

**No findings.**

## 3. Listener leaks — PASS (verified dynamically)

- `dispatchImageLoaded` (app.js:355-365) does `import('./editor.js')` on every dispatch: **harmless** — ES module registry caches the module; subsequent imports resolve the same record without re-executing top-level code, so `initEditor()` runs exactly once. Verified live: double re-dispatch of `sparklerlab:image-loaded` (document + window) produced no new layers, no errors, state unchanged.
- All listeners are bound once inside single-init module scopes: app.js `boot()` `{once:true}`-guarded (app.js:44), editor.js top-level (editor.js:691-695), heads.js auto-init + one rerender-thumbs listener (heads.js:479-486).
- Camera overlay teardown removes its keydown handler and DOM (app.js:390-405).
- LOW **[editor.js:188]** double-dispatch inefficiency: the `imageBitmap` path in `onImageLoaded` lacks the `lastUrlLoaded` guard the URL path has, so the document+window pair rebuilds `baseSource` (full-res canvas + drawImage) twice per image. Waste, not a leak. Suggest mirroring the URL guard.

## 4. Memory — PASS with LOW findings

- Editor rAF loop is self-stopping: `tick()` re-queues only while `flickerActive()` (editor.js:85-89); zero layers / reduced-motion → no idle loop. `requestRender` schedules single frames. Live probe: no runaway frames.
- `liveLoops` Map in heads.js:426 is cleaned by `stopFlicker` (heads.js:470-475); editor uses its own `rafId` instead, Map stays empty.
- Export URL revoked after 2s (editor.js:566); undo stacks capped at 50 (editor.js:21).
- LOW **[app.js:256-266]** replaced `imageBitmap`s are never `.close()`d — old bitmaps await GC. Explicit `window.__sparklerLab.imageBitmap?.close()` before overwrite would release GPU memory deterministically on 50MP phone photos.
- INFO: `baseSource` is a fresh full-res canvas per load, previous one unreferenced → GC'd; no accumulation observed.

## 5. Class-name collision across fragments — PASS (sibling flag cleared)

Per-fragment class inventory shows **zero shared class names** across the 7 fragments (s1-* hero, s2-* explain, lab-*/dz-* lab, head* heads, toolbar-/editor-/file-/check- editor, sample-/gallery- gallery, s5* method). The flagged `s5wrap`/`s5card`/`s5srcname`/`s5lede` (s7-method) appear **only** inside `#s5method` and all CSS rules are id-scoped (index.html:624-655); the s5-editor fragment uses a disjoint set. Grep for unscoped class selectors in the merged stylesheet: zero hits. Duplicate `id="` across fragments: none. The s2-* class prefix (s2-explain) vs `id="s2lab"` (s3-lab fragment) is confusing naming, not a collision.

## 6. Asset budget — PASS

`du -sh site/` = **460K**; excluding `tools/` = **412K** (budget 3MB — 13.8% used). Largest: sample-couple-walk.jpg 78KB, index.html 47KB, editor.js 24KB.

## 7. Global namespace — PASS

Exactly two `window.__sparkler*` globals: `__sparklerLab` (app.js:256) and `__sparklerEditor` QA hook (editor.js:684). No other window/globalThis/self assignments in any module (grep-verified). Everything else is module-scoped. `console.assert` used once (editor.js:547) — fine.

## 8. Accessibility — PASS with LOW findings

- All inputs label-associated: headSelect/blendSelect/glowRange/tintColor/opacityRange via `for` (index.html:946-979), flickerToggle via `check-label` (983), headFileInput via visible label (1014), baToggle/exportBtn/resetBtn via sr-only labels (998-1009). Verified: no orphan inputs.
- Canvas labels: histCanvas `role="img"` + aria-label (index.html:849), editorCanvas aria-label (1019), all 6 thumb canvases aria-label (892-927).
- Keyboard: live-verified — select changes with ArrowDown (classic→heart), range responds to Arrow keys, Ctrl+Z undoes a placement (4→3 layers), Escape deselection + Ctrl+Z/Y in code (editor.js:408-420). All toolbar controls are natively focusable.
- LOW **[index.html:1018-1021]** head *placement* on `#editorCanvas` is pointer-only; no keyboard alternative (no roving-focus hotspot buttons). Toolbar itself is operable, but the core canvas gesture is not keyboard-reachable.
- LOW **[index.html:944]** `role="toolbar"` without ARIA-APG roving-tabindex/focus management; works via natural tab order but not spec-conformant for the role.
- LOW: score/subscore updates (analyze.js:425-428) have no `aria-live` region, so screen readers don't hear analysis results.

## Playwright journey — all clean

```
samples tunnel-drag/flash-blown/couple-walk/sparkler-heart → scores 46/0/46/26, editor base 1600×1067
fileInput upload → score 46, EXIF nulls (synthetic samples carry no EXIF — correct)
3 heads placed + drag → export download "sparkler-exit-lab.png" fired
ctrl+z undo works; localStorage schema {layers, controls}; double re-dispatch idempotent
CONSOLE: 0 messages (0 errors, 0 warnings) | PAGE ERRORS: 0 | FAILED REQUESTS: 0
```

## Findings summary

| # | Sev | Location | Finding |
|---|-----|----------|---------|
| 1 | LOW | editor.js:188 | bitmap-path double-dispatch rebuilds baseSource twice/image; add lastUrlLoaded-style guard |
| 2 | LOW | app.js:256 | no `bitmap.close()` on replaced ImageBitmaps |
| 3 | LOW | index.html:1018 | canvas head placement not keyboard-operable |
| 4 | LOW | index.html:944 | role="toolbar" lacks roving tabindex |
| 5 | LOW | analyze.js:425 | no aria-live on analysis results |

No MEDIUM/HIGH/CRITICAL findings. Grade: **9/10** (would be 10 with the five LOW items addressed; zero errors, zero warnings, zero XSS, zero leaks, 13.8% of budget).
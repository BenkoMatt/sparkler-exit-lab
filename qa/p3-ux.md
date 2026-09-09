# P3 — UX Audit: Sparkler Exit Lab (http://127.0.0.1:8123/index.html)

**Persona:** non-photographer wedding planner, first visit.
**Method:** Python Playwright (Chromium), desktop 1440×900 + mobile 390×844 (touch), full timed journey on the live site; head placement verified via `window.__sparklerEditor` QA hook, export verified by actual download capture. Screenshots: `qa/shots/ux-01…13-*.png`. Probes: `qa/ux_journey.py`, `qa/ux_probe2-4.py`.

**Grade: 8/10**

---

## Timed journey log (desktop 1440×900)

| t | step | result |
|---|---|---|
| 0.0s | Land on hero | Eyebrow "A field guide + browser lab for night wedding exits" + H1 + subline "Why sparkler tunnels vanish in flash photos — and a browser lab to examine your shots…" → what/why/how clear in <5 s ✅ |
| 2.8s | Click "Try the Lab" | Smooth-scrolls to Photo Lab ✅ |
| 3.9s | Click "Send to editor" with NO photo | Guard fires: "Load a photo first…" — but it renders inside the EXIF card a screen above the button ⚠️ |
| 5.7s | Gallery → "Open in lab" (tunnel-drag) | Sample loads into pipeline; canvas visible at top of viewport ✅ (scroll lands slightly high — toolbar below fold) |
| 6.6s | Read analysis in Lab | Score 46/100, three plain-English subscores, actionable recommendations + heuristic disclaimer ✅ |
| 8.6s | "Send to editor →" | Scrolls to editor; photo shown, empty-state correctly hidden ✅ |
| 9.5s | Click canvas | Head placed (layers=1, selected) ✅ |
| 10.1s | "Export PNG" | Real download `sparkler-exit-lab.png`, full source res 1600×1067 ✅ |

**Land → export ≈ 10 s scripted; human-paced ~60–90 s including reading the score. Under the 2-minute bar.**

---

## Findings (severity-tagged)

1. **[MEDIUM] "Open in lab" auto-scroll lands misaligned.** Desktop: editor heading 222 px above viewport top — toolbar and "click a wand tip" hint are below the fold, canvas at top edge. Mobile: canvas 123 px cut off at top. The user lands *almost* in the right place, which reads as "nothing happened" until they scroll. The `block:'start'` scroll should target the toolbar, or account for it.
2. **[MEDIUM] Sample-load has no visible feedback at the click point.** Load takes ~1–2 s (fetch + decode) and nothing changes where the user is looking (no toast/spinner/state change on the button). Combined with #1, the button feels dead. Suggest instant `aria-busy`/caption change or a toast.
3. **[MEDIUM] Destructive gestures are undiscoverable.** The editor hint documents only place/move/scale-rotate. Delete = double-click (desktop) or 600 ms long-press (mobile); deselect = Escape. I only found these in editor.js source. A wrong tap leaves a head the planner can't figure out how to remove (long-press *accidentally* deletes — the opposite confusion). One added hint line fixes it.
4. **[MEDIUM] Head Library cards are dead UI.** Clicking a `.headCard` does nothing (verified: layer count and `headSelect` unchanged). They look clickable next to real buttons; only the editor's separate `<select>` actually switches heads. Make cards select the head or un-style them.
5. **[MEDIUM] "Use camera" is a desktop dead end.** No webcam → "Camera unavailable or permission denied — pick a photo instead." then the file picker force-opens. Honest, but on a desktop it reads as broken; hide it where `getUserMedia`/camera isn't plausibly available.
6. **[LOW] Send-to-editor guard message is invisible to the user who triggered it.** Written into the EXIF card ~900 px above; no toast near the button.
7. **[LOW] Mobile nav tap targets 24 px tall.** Sticky nav wraps to 2 rows (86 px); every link ~24 px high (HIG wants ≥44 px). Brand link 158×24. Functional — no horizontal overflow (docW 390 = winW 390) — but mis-taps are likely.
8. **[LOW] Sections are deep on mobile.** Editor sits ~y8,900; Gallery↔Lab↔Editor round-trips mean long scrolls or nav reliance. Works, but costs the persona momentum.
9. **[LOW] Jargon partially explained.** rear-curtain ✅ (plain "flash fires at the END…trail BEHIND" + a good diagram); TTL ✅ (failure mode in plain words); FEC ⚠️ (values −2/3…−1⅔ stops given, acronym never expanded — non-photographer doesn't know it's flash-exposure compensation); "shutter drag" ⚠️ (concept fully described, but the term itself appears only inside a source link); bokeh ⚠️ (gallery captions only, never defined).
10. **[INFO] Honesty is exemplary.** "Nothing is uploaded" ×3; "heuristic estimate, not a professional review" in Method *and* appended to every analysis result; "demo photos are procedurally synthesized, not real wedding photographs" in Method; gallery intro "not real weddings"; footer repeats it; "artistic overlay, not a physical simulation." ✅
11. **[INFO] Analysis UX is excellent for the persona.** Each subscore carries its own plain-English explainer; recommendations are concrete and non-photographer-friendly ("brace the camera… long hand-held exposures blur everything").
12. **[INFO] Solid details.** Undo/redo enable correctly after first placement; before/after (hold = preview, click = split) works; localStorage persistence; HEIC guidance up front; 44 px min-heights on lab/gallery/editor buttons.

## Mobile 390×844 specifics

- Canvas tap-placement works (tap → layers=1); second tap on same spot selects instead of duplicating ✅; long-press deletes ✅ (but see #3 — discoverable by nobody).
- No horizontal overflow anywhere; toolbar groups ≥44 px, ranges full-width; export produced a download on mobile too.
- Sticky 2-row nav (86 px) + 24 px-tall links are the main mobile gripes; content itself reflows well.

## Dead ends / confusing controls

- Head Library cards: click = nothing (dead UI).
- "Use camera" on desktop: message + forced file picker; feels broken.
- Send-to-editor with no photo: guard exists but lands out of sight.
- Delete/deselect gestures: exist but undocumented anywhere in the UI.

## Verdict

The core loop — land → understand → sample → score/recommendations → editor → place head → export — is fast, honest, and works end-to-end on desktop and mobile (≈10 s scripted, comfortably <2 min human-paced; verified export download). Hero comprehension, heuristic/synthetic honesty, and analysis explanations are the standouts. What keeps this from 9+: misaligned auto-scroll after "Open in lab", zero visible feedback on sample load, undocumented destructive gestures, and the dead Head-Library cards — all cheap fixes. **8/10.**
# Sparkler Exit Lab

A static, 100% client-side field guide + photo lab for night wedding sparkler exits.
It explains why sparklers vanish in flash photos, gives a verified starting recipe
for shooting them right, and ships a browser lab that scores your own shots and
re-lights the wands with customizable procedural sparkler heads.

**Nothing is uploaded. There is no server, no accounts, no tracking, no AI or
cloud vision anywhere in the pipeline.**

## What it does

- **Explain / Shoot** — why TTL flash freezes embers, and a verified settings
  recipe (rear-curtain sync, shutter-drag 1/15–1/60 s, f/1.4–2.8, ISO 800–1600,
  flash exposure compensation −2/3 to −1 2/3 stops).
- **Photo Lab** — drop a night photo in: luminance histogram, sparkler visibility
  score (0–100), subscores, and plain-language recommendations.
- **Head Library + Editor** — six procedurally drawn sparkler heads (plus PNG
  upload) composited onto the wands in your photo; blend, glow, tint, opacity,
  flicker, before/after, undo/redo, full-resolution PNG export.
- **Demo gallery** — four procedurally synthesized samples (not real weddings).

## How the analysis works

The analyzer is heuristic client-side JavaScript and runs entirely in your
browser. It:

1. draws the photo to an offscreen canvas (downscaled to ≤640 px on the long edge),
2. builds a 256-bin luminance histogram and counts clipped (near-white) pixels,
3. finds bright-spot components via connected-component analysis (union-find),
4. classifies each component as a trail (elongated, via covariance principal-axis
   oriented bounding boxes) or an ember, and
5. maps trail count + ember count through soft saturating curves (0–40 + 0–40),
   subtracts a highlight-clipping penalty (0–20), for a 0–100 total.

EXIF (shutter, ISO, aperture, flash-fired flag) is parsed locally from the file
bytes — no metadata ever leaves the browser.

### Limitations

- The score is a **heuristic estimate**, not a professional photo review.
- Very dark or heavily cropped photos can fool the detector and skew the score.
- HEIC files are not decoded outside Safari — convert to JPEG first.
- Demo photos are procedurally synthesized, not real wedding photographs.
- Head color tinting is an artistic overlay, not a physical light simulation.
- Known limitation (documented, R10): head placement on the canvas is
  pointer/touch only — keyboard users can still use export, undo/redo, and
  toolbar toggles, but cannot place or drag heads from the keyboard.
- Recommendations are generic heuristics; they do not account for your venue,
  gear, or flash model.

## Running it

Any static file server works:

```sh
python3 -m http.server 8123 --bind 127.0.0.1
# open http://127.0.0.1:8123/index.html
```

`tools/assemble.py` regenerates `index.html` from the `sections/` fragments.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Caddy.

## Credits

Sources behind the guidance (see the Method & Limitations section on the site
for the full linked list): Rangefinder, Digital Camera World, SLR Lounge,
Mark Davidson, Printique/Adorama, Sparklers.US, Grand Wedding Exit,
I Love Sparklers, Comfy Pixel, Twig & Vine, ComfyPixel tunnel-spacing guide,
and Katch Silva / Andy Saywell for AF-assist guidance. Sparkler burn times are
planning guidance verified against multiple sparkler-retailer guides, not
measurements.

Site imagery is procedurally generated code — no copyrighted photos are used.
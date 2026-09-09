/*! analyze.js — Sparkler Exit Lab photo analyzer (P2 engine wave, analyze child)
 *  Plain ES2020 module. No deps, no build step. All math is client-side canvas work.
 *
 *  - export analyzeImage(source, exif?) -> breakdown | null
 *  - auto-registers: 'sparklerlab:image-loaded' (document AND window) -> analyze + populate lab UI
 *  - publishes window.__sparklerLab.analysis = { total, trail, ember, clip, components: nTrails, nEmbers }
 *  - all DOM lookups are null-guarded (section may be absent, e.g. self-test page)
 */

const MAX_ANALYSIS_W = 640;        // analysis scale cap (px)
const MIN_COMPONENT_PX = 4;        // below this = sensor noise, ignored
const MAX_COMPONENT_PX = 5000;     // per-component pixel cap (huge flash blobs skipped)
const TRAIL_ASPECT_MIN = 3.5;      // oriented bbox aspect to call it a trail
const TRAIL_MIN_LENGTH = 18;       // px at analysis scale
const CLIP_LUMA = 250;             // luminance where clipping starts
const CLIP_FULL_FRAC = 0.08;       // clipped-px fraction that maps to full penalty (20)
const TRAIL_CURVE_K = 6;           // soft-curve constants for count -> score mapping
const EMBER_CURVE_K = 25;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/* ---------- EXIF normalization (tolerant: exif.js owns the real parser) ---------- */

function firstOf(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return null;
}

// '1/125' -> 0.008, '0.5s' -> 0.5, 2 -> 2
function parseSeconds(v) {
  if (typeof v === 'number' && isFinite(v) && v > 0) return v;
  if (typeof v !== 'string') return null;
  const m = v.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const den = parseFloat(m[2]);
    const num = parseFloat(m[1]);
    return den > 0 ? num / den : null;
  }
  const n = parseFloat(v.replace(/[^\d.]/g, ''));
  return isFinite(n) && n > 0 ? n : null;
}

// 'f/2.8' | 'F2.8' | '2.8' | 2.8 -> 2.8
function parseAperture(v) {
  if (typeof v === 'number' && isFinite(v) && v > 0) return v;
  if (typeof v !== 'string') return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return isFinite(n) && n > 0 ? n : null;
}

function parseISO(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v.replace(/[^\d]/g, ''), 10);
    return isFinite(n) ? n : null;
  }
  return null;
}

function parseFlash(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'fired' || s === 'flash fired' || s === 'on' || s === 'yes' || s === 'true' || s === '1') return true;
    if (s === 'no' || s === 'off' || s === 'did not fire' || s === 'false' || s === '0') return false;
  }
  return null;
}

function normalizeExif(raw) {
  return {
    shutter: parseSeconds(firstOf(raw, ['shutter', 'shutterSpeed', 'exposureTime', 'exposure'])),
    aperture: parseAperture(firstOf(raw, ['aperture', 'fNumber', 'fStop', 'f'])),
    iso: parseISO(firstOf(raw, ['iso', 'ISO', 'isoSpeed'])),
    flashFired: parseFlash(firstOf(raw, ['flashFired', 'flash', 'flashOn']))
  };
}

/* ---------- drawable-source duck typing (works in browser and plain node import) ---------- */

function isDrawable(s) {
  if (!s || typeof s !== 'object') return false;
  if (typeof ImageBitmap !== 'undefined' && s instanceof ImageBitmap) return true;
  if (typeof OffscreenCanvas !== 'undefined' && s instanceof OffscreenCanvas) return true;
  if (typeof HTMLCanvasElement !== 'undefined' && s instanceof HTMLCanvasElement) return true;
  if (typeof HTMLImageElement !== 'undefined' && s instanceof HTMLImageElement) return true;
  if (typeof HTMLVideoElement !== 'undefined' && s instanceof HTMLVideoElement) return true;
  return typeof s.width === 'number' && typeof s.height === 'number' && s.width > 0 && s.height > 0;
}

function sourceSize(s) {
  return [
    (s.naturalWidth || s.videoWidth || s.width) | 0,
    (s.naturalHeight || s.videoHeight || s.height) | 0
  ];
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try { return new OffscreenCanvas(w, h); } catch (e) { /* fall through */ }
  }
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

/* ---------- core analysis ---------- */

let lastHist = null; // kept for renderHistogram() after an event-driven run

export function analyzeImage(source, exifRaw) {
  if (!isDrawable(source)) return null;
  const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const [sw, sh] = sourceSize(source);
  if (!(sw > 0 && sh > 0)) return null;

  // (1) offscreen draw at analysis scale (downscale only, never upscale)
  const scale = Math.min(1, MAX_ANALYSIS_W / sw);
  const W = Math.max(1, Math.round(sw * scale));
  const H = Math.max(1, Math.round(sh * scale));
  const cnv = makeCanvas(W, H);
  if (!cnv) return null;
  let ctx = null;
  try { ctx = cnv.getContext('2d', { willReadFrequently: true }); } catch (e) { ctx = null; }
  if (!ctx) return null;
  try { ctx.drawImage(source, 0, 0, W, H); } catch (e) { return null; }
  let img;
  try { img = ctx.getImageData(0, 0, W, H); } catch (e) { return null; }
  const px = img.data;
  const N = W * H;

  // (1b) typed-array luminance pass: 256-bin histogram + clip count in one sweep
  const luma = new Uint8Array(N);
  const hist = new Uint32Array(256);
  let clipCount = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const l = (px[p] * 54 + px[p + 1] * 183 + px[p + 2] * 19) >> 8; // ≈ Rec.709 * 256
    luma[i] = l;
    hist[l]++;
    if (l >= CLIP_LUMA) clipCount++;
  }
  lastHist = hist;

  // p98 of luminance -> adaptive threshold (never below 180)
  let p98 = 255;
  {
    const target = N * 0.98;
    let cum = 0;
    for (let b = 0; b < 256; b++) {
      cum += hist[b];
      if (cum >= target) { p98 = b; break; }
    }
  }
  const threshold = Math.max(180, p98);

  // (3) connected components of bright pixels — two-pass union-find, no recursion
  const labels = new Int32Array(N).fill(-1);
  const parent = new Int32Array(N).fill(-1);
  let nextLabel = 0;
  const find = (x) => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) { const n = parent[x]; parent[x] = r; x = n; } // path compression
    return r;
  };
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x;
      if (luma[i] < threshold) continue;
      const up = y > 0 ? labels[i - W] : -1;
      const le = x > 0 ? labels[i - 1] : -1;
      let l = -1;
      if (up >= 0 && le >= 0) {
        const ru = find(up);
        const rl = find(le);
        l = ru;
        if (ru !== rl) parent[rl] = ru;
      } else if (up >= 0) {
        l = find(up);
      } else if (le >= 0) {
        l = find(le);
      }
      if (l < 0) { l = nextLabel++; parent[l] = l; }
      labels[i] = l;
    }
  }

  // resolve roots -> compact component ids; count via one pass
  const rootCount = new Int32Array(nextLabel);
  for (let i = 0; i < N; i++) {
    const l = labels[i];
    if (l >= 0) rootCount[find(l)]++;
  }
  const compRoots = [];
  for (let l = 0; l < nextLabel; l++) if (rootCount[l] > 0) compRoots.push(l);
  const C = compRoots.length;
  const compId = new Int32Array(nextLabel).fill(-1);
  for (let k = 0; k < C; k++) compId[compRoots[k]] = k;

  // pixel moments + counting-sort pixel index (each component's pixels stored contiguously)
  const cnt = new Int32Array(C);
  const start = new Int32Array(C + 1);
  for (let i = 0; i < N; i++) {
    const l = labels[i];
    if (l >= 0) cnt[compId[find(l)]]++;
  }
  for (let k = 0; k < C; k++) start[k + 1] = start[k] + cnt[k];
  const sumX = new Float64Array(C), sumY = new Float64Array(C);
  const sumXX = new Float64Array(C), sumYY = new Float64Array(C), sumXY = new Float64Array(C);
  const pixelIdx = new Int32Array(start[C]);
  const cursor = Int32Array.from(start); // write cursors per component
  for (let i = 0; i < N; i++) {
    const l = labels[i];
    if (l < 0) continue;
    const k = compId[find(l)];
    if (k < 0) continue;
    const x = i % W;
    pixelIdx[cursor[k]++] = i;
    sumX[k] += x;
    sumY[k] += (i - x) / W;
    sumXX[k] += x * x;
    sumXY[k] += x * ((i - x) / W);
    sumYY[k] += ((i - x) / W) * ((i - x) / W);
  }

  // per-component: covariance principal axis -> oriented bbox -> TRAIL vs EMBER
  const isTrail = new Uint8Array(C);
  let nTrails = 0;
  let nEmbers = 0;
  for (let k = 0; k < C; k++) {
    const n = cnt[k];
    if (n < MIN_COMPONENT_PX || n > MAX_COMPONENT_PX) continue; // noise / flash blob: skipped
    const cx = sumX[k] / n;
    const cy = sumY[k] / n;
    const cxx = sumXX[k] / n - cx * cx;
    const cyy = sumYY[k] / n - cy * cy;
    const cxy = sumXY[k] / n - cx * cy;
    const tr = cxx + cyy;
    const disc = Math.max(0, (tr * tr) / 4 - (cxx * cyy - cxy * cxy));
    const l1 = tr / 2 + Math.sqrt(disc);        // largest eigenvalue
    const l2 = Math.max(0, tr / 2 - Math.sqrt(disc));
    // principal axis direction
    let ux, uy;
    if (cxy !== 0) { ux = l1 - cyy; uy = cxy; }
    else { ux = cxx >= cyy ? 1 : 0; uy = cxx >= cyy ? 0 : 1; }
    const un = Math.hypot(ux, uy) || 1;
    ux /= un; uy /= un;
    const vx = -uy, vy = ux;
    // oriented bounding box: project only this component's pixels (bounded by its own count)
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let j = start[k]; j < start[k] + n; j++) {
      const i = pixelIdx[j];
      const x = i % W;
      const y = (i - x) / W;
      const dx = x - cx, dy = y - cy;
      const u = dx * ux + dy * uy;
      const v = dx * vx + dy * vy;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const lenU = maxU - minU;
    const lenV = maxV - minV;
    const aspect = lenU / Math.max(lenV, 1);
    if (aspect > TRAIL_ASPECT_MIN && lenU >= TRAIL_MIN_LENGTH) {
      isTrail[k] = 1;
      nTrails++;
    } else {
      nEmbers++;
    }
  }

  // (4) score mapping: soft saturating curves, then clipping penalty
  const trailScore = clamp(Math.round(40 * (1 - Math.exp(-nTrails / TRAIL_CURVE_K))), 0, 40);
  const emberScore = clamp(Math.round(40 * (1 - Math.exp(-nEmbers / EMBER_CURVE_K))), 0, 40);
  const clipFrac = N > 0 ? clipCount / N : 0;
  const clipPenalty = clamp(Math.round(20 * Math.min(1, clipFrac / CLIP_FULL_FRAC)), 0, 20);
  const total = clamp(Math.round(trailScore + emberScore - clipPenalty), 0, 100);

  const t1 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const analysis = {
    total,
    trail: trailScore,
    ember: emberScore,
    clip: clipPenalty,
    nTrails,
    nEmbers,
    components: nTrails,   // spec shape: window.__sparklerLab.analysis.components = nTrails
    nEmbersAlt: nEmbers,
    threshold,
    p98,
    clipFrac,
    analysisWidth: W,
    analysisHeight: H,
    ms: t0 ? Math.round((t1 - t0) * 10) / 10 : null
  };
  if (typeof window !== 'undefined') {
    window.__sparklerLab = window.__sparklerLab || {};
    window.__sparklerLab.analysis = analysis;
  }
  return analysis;
}

/* ---------- histogram rendering (dark theme) ---------- */

function renderHistogram(canvas, hist, clipFrac) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!(W > 0 && H > 0)) return;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#141824';                       // panel bg token
  ctx.fillRect(0, 0, W, H);

  const baselineY = H - 16;
  const maxH = baselineY - 8;
  let maxV = 0;
  for (let b = 0; b < 256; b++) if (hist[b] > maxV) maxV = hist[b];
  if (maxV <= 0) maxV = 1;

  // clip zone backdrop (red) behind the blown bins
  const clipX = (CLIP_LUMA / 256) * W;
  ctx.fillStyle = 'rgba(255, 107, 107, 0.10)';
  ctx.fillRect(clipX, 0, W - clipX, baselineY);

  // gold bars, sqrt-scaled so night-photo midtones stay visible
  const barW = W / 256;
  for (let b = 0; b < 256; b++) {
    const v = hist[b];
    if (!v) continue;
    const bh = Math.max(b === 255 || v === maxV ? 2 : 1, Math.sqrt(v / maxV) * maxH);
    ctx.fillStyle = b >= CLIP_LUMA ? '#ff6b6b' : 'rgba(255, 179, 71, 0.85)';
    ctx.fillRect(b * barW, baselineY - bh, Math.max(1, barW - 0.25), bh);
  }

  // clip zone marker
  ctx.strokeStyle = 'rgba(255, 107, 107, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(clipX + 0.5, 2);
  ctx.lineTo(clipX + 0.5, baselineY);
  ctx.stroke();

  // axis baseline + ticks (muted token)
  ctx.strokeStyle = '#232936';
  ctx.beginPath();
  ctx.moveTo(0, baselineY + 0.5);
  ctx.lineTo(W, baselineY + 0.5);
  ctx.stroke();
  ctx.fillStyle = '#9aa0ae';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('0', 2, H - 4);
  ctx.textAlign = 'center';
  ctx.fillText('128', W / 2, H - 4);
  ctx.textAlign = 'right';
  ctx.fillText('255', W - 2, H - 4);
  ctx.fillStyle = 'rgba(255, 107, 107, 0.9)';
  ctx.fillText('clip', Math.min(W - 2, clipX + 18), 10);
}

/* ---------- UI population (all null-guarded) ---------- */

function setText(id, value) {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function trailLabel(v) { return v <= 0 ? 'none' : v < 10 ? 'weak' : v < 20 ? 'fair' : v < 30 ? 'good' : 'strong'; }
function emberLabel(v) { return v <= 0 ? 'none' : v < 10 ? 'sparse' : v < 20 ? 'moderate' : v < 30 ? 'dense' : 'rich'; }
function clipLabel(v) { return v <= 0 ? 'none' : v < 5 ? 'light' : v < 12 ? 'moderate' : 'severe'; }

function buildRecommendations(a, exif, nTrails) {
  const recs = [];
  if (nTrails === 0 && exif.flashFired === true) {
    recs.push('front-curtain flash is freezing the embers - switch to rear-curtain sync');
  }
  if (a.trail < 15 && typeof exif.shutter === 'number' && exif.shutter <= 1 / 125) {
    recs.push('slow the shutter into shutter-drag range (1/15-1/60s)');
  }
  if (a.ember < 15 && typeof exif.aperture === 'number' && exif.aperture >= 4) {
    recs.push('open the aperture (f/1.4-2.8) - sparkler brightness depends on ISO and aperture, not shutter');
  }
  if (a.ember < 15 && typeof exif.iso === 'number' && exif.iso <= 400) {
    recs.push('raise ISO 800-1600');
  }
  if (a.clip >= 10) {
    recs.push('highlights are clipped - pull flash exposure compensation down (-2/3 to -1 2/3 stops)');
  }
  if (a.total >= 70) {
    recs.push('strong sparkler visibility - this is the shutter-drag look');
  }
  // honest generic fill so the list is never thinner than 3
  const pool = [
    'no trails detected - try a 1-4s exposure and move the sparkler while the shutter is open',
    'too few embers - a wider aperture or higher ISO gathers more sparkler light',
    'brace the camera (tripod, wall, elbow) - long hand-held exposures blur everything',
    'shoot several frames quickly - sparklers burn 30-60s, so pre-compose before lighting'
  ];
  for (const p of pool) {
    if (recs.length >= 3) break;
    if (!recs.includes(p)) recs.push(p);
  }
  return recs;
}

function populateUI(analysis, exif) {
  if (typeof document === 'undefined' || !document.getElementById) return;
  setText('scoreNum', String(analysis.total));
  setText('subTrail', `${analysis.trail}/40 - ${trailLabel(analysis.trail)}`);
  setText('subEmber', `${analysis.ember}/40 - ${emberLabel(analysis.ember)}`);
  setText('subClip', `${analysis.clip}/20 - ${clipLabel(analysis.clip)}`);

  const recList = document.getElementById('recList');
  if (recList) {
    recList.textContent = '';
    for (const r of buildRecommendations(analysis, exif, analysis.nTrails)) {
      const li = document.createElement('li');
      li.textContent = r;
      recList.appendChild(li);
    }
    const footer = document.createElement('li');
    footer.textContent = 'Heuristic estimate - see Method and Limitations.';
    footer.style.color = '#9aa0ae';
    footer.style.fontStyle = 'italic';
    recList.appendChild(footer);
  }
}

/* ---------- event wiring ---------- */

let lastSource = null;
let lastRunAt = 0;

function handleImageLoaded() {
  const bundle = (typeof window !== 'undefined' && window.__sparklerLab) || {};
  const src = firstOf(bundle, ['source', 'image', 'bitmap', 'canvas', 'img']);
  if (!isDrawable(src)) {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[analyze] sparklerlab:image-loaded carried no drawable source');
    }
    return;
  }
  // debounce double dispatch (document + window both hear the event)
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  if (src === lastSource && now - lastRunAt < 120) return;

  // <img> that has not finished decoding: wait, then re-enter
  if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement && !(src.complete && src.naturalWidth > 0)) {
    const rerun = () => { lastSource = null; handleImageLoaded(); };
    if (typeof src.decode === 'function') src.decode().then(rerun, rerun);
    else src.addEventListener('load', rerun, { once: true });
    return;
  }
  lastSource = src;
  lastRunAt = now;

  const exif = normalizeExif(firstOf(bundle, ['exif', 'exifData', 'meta']));
  const analysis = analyzeImage(src, exif);
  if (!analysis) return;
  populateUI(analysis, exif);
  renderHistogram(document.getElementById('histCanvas'), lastHist, analysis.clipFrac);
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('sparklerlab:image-loaded', handleImageLoaded);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('sparklerlab:image-loaded', handleImageLoaded);
  // late-import catch-up: an image may already sit in the bundle, unanalyzed
  if (window.__sparklerLab && !window.__sparklerLab.analysis &&
      isDrawable(firstOf(window.__sparklerLab, ['source', 'image', 'bitmap', 'canvas', 'img']))) {
    queueMicrotask(handleImageLoaded);
  }
}
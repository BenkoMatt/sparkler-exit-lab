/* heads.js v1.0 — Sparkler Exit Lab procedural head generator + thumbnail painter.
 * Plain ES2020 module, no deps. Every head: warm gold strokes + embers, additive
 * ('lighter') layering for brightness, soft radial glow behind, scale-invariant via `size`.
 * Exports: drawHead, init, paintThumb, startFlicker, stopFlicker, HEAD_KINDS.
 */

const DEFAULT_TINT = '#ffb347';
const FONT_STACK = "'Brush Script MT','Segoe Script','Snell Roundhand','Lucida Handwriting',cursive";

export const HEAD_KINDS = ['classic', 'heart', 'star', 'initials', 'flame', 'orb', 'upload'];

/* ---------- utils ---------- */

function clamp01(v) {
  v = Number(v);
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hexToRgb(hex) {
  let h = String(hex || DEFAULT_TINT).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return { r: 255, g: 179, b: 71 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(c, a) {
  return `rgba(${c.r},${c.g},${c.b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function hashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Deterministic PRNG so heads are reproducible per flickerPhase. */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* Subtle 10–20% brightness wobble driven by phase (1 when phase is 0/falsy). */
function wobble(phase) {
  const p = Number(phase) || 0;
  if (p === 0) return 1;
  const s = Math.sin(p * 2.7) * 0.6 + Math.sin(p * 4.31 + 1.7) * 0.4;
  return 0.9 + 0.1 * (s * 0.5 + 0.5) * 2; // 0.9 .. 1.1
}

/* ---------- shared drawing pieces ---------- */

function drawGlowBackdrop(ctx, x, y, size, tint, glow, flick) {
  const g = clamp01(glow);
  const r = size * (0.35 + 0.35 * g) * (0.92 + 0.08 * flick);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  grad.addColorStop(0, rgba(tint, 0.55 * (0.4 + 0.6 * g) * flick));
  grad.addColorStop(0.5, rgba(tint, 0.22 * (0.4 + 0.6 * g) * flick));
  grad.addColorStop(1, rgba(tint, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/* Hot white-gold core: radial gradient + tiny saturated dot. */
function drawCore(ctx, x, y, size, tint, flick) {
  const r = Math.max(1, size * 0.11 * (0.85 + 0.15 * flick));
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(255,252,240,${(0.98 * flick).toFixed(3)})`);
  grad.addColorStop(0.35, rgba(tint, 0.85 * flick));
  grad.addColorStop(1, rgba(tint, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,248,${(0.95 * flick).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.8, size * 0.028), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEmber(ctx, x, y, r, tint, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(tint, alpha);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.4, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,250,235,${(alpha * 0.55).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.25, r * 0.45), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* Double-pass stroke: wide soft pass + thin bright pass (additive). */
function strokeTwice(ctx, pathFn, size, tint, flick) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  pathFn();
  ctx.strokeStyle = rgba(tint, 0.28 * flick);
  ctx.lineWidth = Math.max(1, size * 0.055);
  ctx.stroke();
  pathFn();
  ctx.strokeStyle = `rgba(255,238,190,${(0.92 * flick).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.8, size * 0.018);
  ctx.stroke();
  ctx.restore();
}

/* Twinkling embers at fixed seeded positions + a few per-frame micro sparks. */
function scatterEmbers(ctx, cx, cy, size, tint, phase, count, spread, seedSalt) {
  const base = mulberry32(hashStr(seedSalt));
  const p = Number(phase) || 0;
  for (let i = 0; i < count; i++) {
    const a = base() * Math.PI * 2;
    const rr = spread * (0.35 + 0.65 * base());
    const ex = cx + Math.cos(a) * rr;
    const ey = cy + Math.sin(a) * rr;
    const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(p * (1.5 + base() * 3) + base() * 6.28));
    drawEmber(ctx, ex, ey, size * (0.006 + 0.012 * base()), tint, 0.5 * tw);
  }
  const burst = mulberry32((hashStr(seedSalt) ^ Math.imul(Math.floor(p * 8) + 1, 2654435761)) >>> 0);
  const nBurst = 3 + Math.floor(burst() * 4);
  for (let i = 0; i < nBurst; i++) {
    const a = burst() * Math.PI * 2;
    const rr = spread * (0.5 + 0.6 * burst());
    drawEmber(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, size * 0.008, tint, 0.35 + 0.4 * burst());
  }
}

/* ---------- head painters ---------- */

function drawClassic(ctx, x, y, size, tint, phase, flick) {
  const p = Number(phase) || 0;
  const rnd = mulberry32((hashStr('classic') ^ Math.imul(Math.floor(p * 9) + 1, 2654435761)) >>> 0);
  const n = 14 + Math.floor(rnd() * 7); // 14–20 strokes
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.9;
    const len = size * (0.22 + rnd() * 0.5);
    const bend = (rnd() - 0.5) * size * 0.18;
    const x2 = x + Math.cos(a) * len + Math.cos(a + Math.PI / 2) * bend;
    const y2 = y + Math.sin(a) * len + Math.sin(a + Math.PI / 2) * bend;
    const mx = (x + x2) / 2 + Math.cos(a + Math.PI / 2) * bend * 0.6;
    const my = (y + y2) / 2 + Math.sin(a + Math.PI / 2) * bend * 0.6;
    const w = Math.max(0.7, size * (0.008 + rnd() * 0.016));
    const bright = 0.55 + rnd() * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.strokeStyle = rgba(tint, 0.3 * bright * flick);
    ctx.lineWidth = w * 2.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.strokeStyle = `rgba(255,240,200,${(0.75 * bright * flick).toFixed(3)})`;
    ctx.lineWidth = w;
    ctx.stroke();
    drawEmber(ctx, x2, y2, size * (0.008 + rnd() * 0.012), tint, 0.6 + 0.35 * rnd());
  }
  ctx.restore();
  drawCore(ctx, x, y, size, tint, flick);
}

function heartPoint(t) {
  return {
    x: 16 * Math.pow(Math.sin(t), 3),
    y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
  };
}

function drawHeart(ctx, x, y, size, tint, phase, flick) {
  const scale = size / 34;
  const oy = y - 2.5 * scale * -1; // shift so heart is vertically centered (math y-up)
  const pathFn = () => {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      const pt = heartPoint(t);
      const px = x + pt.x * scale;
      const py = oy - pt.y * scale; // flip y for canvas
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  strokeTwice(ctx, pathFn, size, tint, flick);
  scatterEmbers(ctx, x, y, size, tint, phase, 26, size * 0.46, 'heart');
  drawCore(ctx, x, y - 2 * scale, size, tint, flick);
}

function drawStar(ctx, x, y, size, tint, phase, flick) {
  const rOut = size * 0.36;
  const rIn = size * 0.15;
  const pathFn = () => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? rOut : rIn;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  strokeTwice(ctx, pathFn, size, tint, flick);
  scatterEmbers(ctx, x, y, size, tint, phase, 24, size * 0.46, 'star');
  drawCore(ctx, x, y, size, tint, flick);
}

function drawInitials(ctx, x, y, size, tint, phase, flick, opts) {
  const raw = opts.text == null ? '' : String(opts.text);
  const text = (raw.trim() || 'J+M').slice(0, 6) || 'US';
  let fs = Math.round(size * 0.48);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `300 ${fs}px ${FONT_STACK}`;
  const maxW = size * 0.9;
  let w = ctx.measureText(text).width;
  if (w > maxW && w > 0) {
    fs = Math.max(4, Math.round(fs * (maxW / w)));
    ctx.font = `300 ${fs}px ${FONT_STACK}`;
  }
  ctx.globalCompositeOperation = 'lighter';
  /* pass 1: wide soft glow */ {
    ctx.shadowColor = rgba(tint, 0.9);
    ctx.shadowBlur = size * 0.16;
    ctx.fillStyle = rgba(tint, 0.55 * flick);
    ctx.fillText(text, x, y);
  }
  /* pass 2: tight hot glow */ {
    ctx.shadowColor = 'rgba(255,240,200,0.95)';
    ctx.shadowBlur = size * 0.05;
    ctx.fillStyle = `rgba(255,246,220,${(0.9 * flick).toFixed(3)})`;
    ctx.fillText(text, x, y);
  }
  ctx.shadowBlur = 0;
  /* thin crackle stroke over the glyphs */
  ctx.strokeStyle = `rgba(255,235,180,${(0.4 * flick).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.6, size * 0.006);
  ctx.strokeText(text, x, y);
  ctx.restore();
  scatterEmbers(ctx, x, y, size, tint, phase, 22, size * 0.48, 'initials');
  drawEmber(ctx, x, y, size * 0.02, tint, 0.8 * flick);
}

function flamePathFn(ctx, x, y, size) {
  return () => {
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.5);
    ctx.bezierCurveTo(x + size * 0.3, y - size * 0.12, x + size * 0.3, y + size * 0.24, x, y + size * 0.42);
    ctx.bezierCurveTo(x - size * 0.3, y + size * 0.24, x - size * 0.3, y - size * 0.12, x, y - size * 0.5);
    ctx.closePath();
  };
}

function drawFlame(ctx, x, y, size, tint, phase, flick) {
  strokeTwice(ctx, flamePathFn(ctx, x, y, size), size, tint, flick);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  /* inner bright core teardrop */
  const inner = () => {
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.26);
    ctx.bezierCurveTo(x + size * 0.15, y - size * 0.05, x + size * 0.15, y + size * 0.14, x, y + size * 0.26);
    ctx.bezierCurveTo(x - size * 0.15, y + size * 0.14, x - size * 0.15, y - size * 0.05, x, y - size * 0.26);
    ctx.closePath();
  };
  inner();
  ctx.fillStyle = `rgba(255,250,232,${(0.85 * flick).toFixed(3)})`;
  ctx.fill();
  inner();
  ctx.fillStyle = rgba(tint, 0.5 * flick);
  ctx.fill();
  ctx.restore();
  /* rising embers */
  const p = Number(phase) || 0;
  const rnd = mulberry32((hashStr('flame') ^ Math.imul(Math.floor(p * 7) + 1, 2654435761)) >>> 0);
  const n = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const ex = x + (rnd() - 0.5) * size * 0.42;
    const ey = y - size * (0.55 + rnd() * 0.5);
    drawEmber(ctx, ex, ey, size * (0.006 + rnd() * 0.01), tint, 0.35 + 0.5 * rnd());
  }
  drawCore(ctx, x + size * 0.02, y + size * 0.02, size * 0.9, tint, flick);
}

function drawOrb(ctx, x, y, size, tint, phase, flick) {
  const p = Number(phase) || 0;
  const rnd = mulberry32(hashStr('orb')); // fixed positions; alpha twinkles
  const n = 220;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const R = size * 0.34;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = R * Math.pow(rnd(), 1.5); // radial density falloff (denser center)
    const ex = x + Math.cos(a) * rr;
    const ey = y + Math.sin(a) * rr;
    const speed = 1.2 + rnd() * 3.2;
    const off = rnd() * Math.PI * 2;
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p * speed + off));
    const bright = 0.3 + rnd() * 0.7;
    drawEmber(ctx, ex, ey, size * (0.005 + rnd() * 0.011), tint, Math.min(1, 0.55 * tw * bright * flick));
  }
  ctx.restore();
  drawCore(ctx, x, y, size, tint, flick);
}

function drawUpload(ctx, x, y, size, tint, phase, flick, opts) {
  const img = opts.image;
  let drew = false;
  if (img && (typeof HTMLImageElement === 'undefined' || img instanceof HTMLImageElement) && img.complete && img.naturalWidth > 0) {
    const maxSide = size * 0.78;
    const scale = Math.min(maxSide / img.naturalWidth, maxSide / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // screen-like additive compositing (globalAlpha already = opacity)
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    ctx.restore();
    drew = true;
  }
  /* small glow ring */
  const ring = () => {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.42, 0, Math.PI * 2);
  };
  strokeTwice(ctx, ring, size, tint, flick);
  if (!drew) scatterEmbers(ctx, x, y, size, tint, phase, 14, size * 0.4, 'upload');
  drawEmber(ctx, x, y, size * 0.018, tint, 0.75 * flick);
}

/* ---------- public API ---------- */

/**
 * Draw a procedural sparkler head.
 * @param {CanvasRenderingContext2D} ctx
 * @param {'classic'|'heart'|'star'|'initials'|'flame'|'orb'|'upload'} kind
 * @param {number} x center x
 * @param {number} y center y
 * @param {number} size nominal diameter (scale-invariant drawing)
 * @param {object} [opts] {tint, glow 0..1, opacity 0..1, flickerPhase, text, image}
 */
export function drawHead(ctx, kind, x, y, size, opts = {}) {
  if (!ctx || typeof ctx.beginPath !== 'function') return;
  const s = Math.max(1, Number(size) || 0);
  const tint = hexToRgb(opts.tint || DEFAULT_TINT);
  const glow = clamp01(opts.glow == null ? 0.6 : opts.glow);
  const opacity = clamp01(opts.opacity == null ? 1 : opts.opacity);
  const flick = wobble(opts.flickerPhase);

  ctx.save();
  ctx.globalAlpha = opacity;
  drawGlowBackdrop(ctx, x, y, s, tint, glow, flick);
  switch (kind) {
    case 'heart': drawHeart(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
    case 'star': drawStar(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
    case 'initials': drawInitials(ctx, x, y, s, tint, opts.flickerPhase, flick, opts); break;
    case 'flame': drawFlame(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
    case 'orb': drawOrb(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
    case 'upload': drawUpload(ctx, x, y, s, tint, opts.flickerPhase, flick, opts); break;
    case 'classic':
    default: drawClassic(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
  }
  ctx.restore();
}

/** Paint one thumbnail canvas from its data-head/data-text/data-tint attrs. */
export function paintThumb(cv) {
  if (!cv || typeof cv.getContext !== 'function') return false;
  const ctx = cv.getContext('2d');
  if (!ctx) return false;
  const w = cv.width;
  const h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const kind = cv.dataset.head || 'classic';
  drawHead(ctx, kind, w / 2, h / 2, Math.min(w, h) * 0.74, {
    tint: cv.dataset.tint || DEFAULT_TINT,
    glow: 0.65,
    opacity: 1,
    flickerPhase: 0,
    text: cv.dataset.text || '',
  });
  return true;
}

/** Paint every canvas.thumb[data-head] under `root` (default document). Returns count. */
export function init(root) {
  const doc = typeof document === 'undefined' ? null : document;
  const scope = root || doc;
  if (!scope || typeof scope.querySelectorAll !== 'function') return 0;
  const thumbs = scope.querySelectorAll('canvas.thumb[data-head]');
  let n = 0;
  thumbs.forEach((cv) => {
    if (paintThumb(cv)) n++;
  });
  return n;
}

/* ---------- editor flicker loop (opt-in) ---------- */

const liveLoops = new Map(); // canvas -> {kind, opts, raf, offset}
const reduceMotion =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/**
 * rAF flicker loop for one canvas (editor use). Per-head phase advance with a
 * subtle 10–20% brightness wobble. Honors prefers-reduced-motion: paints a
 * static frame and does not loop.
 */
export function startFlicker(cv, kind, opts = {}) {
  if (!cv || typeof cv.getContext !== 'function') return null;
  stopFlicker(cv);
  const state = { kind, opts, raf: 0, offset: Math.random() * 10 };
  liveLoops.set(cv, state);
  if (reduceMotion && reduceMotion.matches) {
    paintFlickerFrame(cv, state, 0, 1);
    return state;
  }
  const tickFn = (ts) => {
    if (liveLoops.get(cv) !== state) return;
    const phase = (ts / 1000) * 1.6 + state.offset; // per-head phase advance
    paintFlickerFrame(cv, state, phase, 1);
    state.raf = requestAnimationFrame(tickFn);
  };
  state.raf = requestAnimationFrame(tickFn);
  return state;
}

function paintFlickerFrame(cv, state, phase, brightness) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const o = state.opts || {};
  drawHead(ctx, state.kind, Number(o.x) || cv.width / 2, Number(o.y) || cv.height / 2,
    Number(o.size) || Math.min(cv.width, cv.height) * 0.74, {
      tint: o.tint || DEFAULT_TINT,
      glow: clamp01(o.glow == null ? 0.65 : o.glow) * brightness,
      opacity: clamp01(o.opacity == null ? 1 : o.opacity),
      flickerPhase: phase,
      text: o.text || '',
      image: o.image,
    });
}

export function stopFlicker(cv) {
  const state = liveLoops.get(cv);
  if (!state) return;
  if (state.raf) cancelAnimationFrame(state.raf);
  liveLoops.delete(cv);
}

/* ---------- auto-init ---------- */

if (typeof document !== 'undefined') {
  const boot = () => init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  document.addEventListener('sparklerlab:rerender-thumbs', () => init());
}
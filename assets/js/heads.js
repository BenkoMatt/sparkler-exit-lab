/* heads.js v2.0 — Sparkler Exit Lab procedural head generator + thumbnail painter.
 * Plain ES2020 module, no deps. Six REALISM variants of the classic pyrotechnic
 * burst (classic / crackle / trail / dense / gravity / fan) share one burst engine
 * (drawBurstBase) whose profile tunes: arm count, length distribution, per-segment
 * wander, branching probability + generation depth (primary -> branch -> sub-branch,
 * like iron/steel particles splitting as they oxidize), ember density along arms vs
 * at tips, gravity droop (t^2), wind drift, alpha fade along length, ember twinkle
 * rate, and core size/brightness. Every head: white-hot inner strokes
 * (rgba(255,240,200)) + tinted outer glow, embers cooling gold -> dim orange, additive
 * ('lighter') layering for brightness, soft radial glow behind, scale-invariant via `size`.
 * Exports: drawHead, init, paintThumb, startFlicker, stopFlicker, HEAD_KINDS.
 */

const DEFAULT_TINT = '#ffb347';

export const HEAD_KINDS = ['classic', 'crackle', 'trail', 'dense', 'gravity', 'fan', 'upload'];

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

/* ---------- realistic-burst engine ---------- */

const HOT_INNER = { r: 255, g: 240, b: 200 };
const COOL_TIP = { r: 255, g: 140, b: 60 }; // embers cool: white-hot -> gold -> dim orange-red

/* Point at parameter t (0..1) along a polyline, plus local direction. */
function limbPoint(pts, t) {
  const segs = pts.length - 1;
  const f = clamp01(t) * segs;
  const i = Math.min(segs - 1, Math.floor(f));
  const u = f - i;
  return {
    x: pts[i].x + (pts[i + 1].x - pts[i].x) * u,
    y: pts[i].y + (pts[i + 1].y - pts[i].y) * u,
    a: Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x),
  };
}

/* Remap a 0..1 sample toward the edges (k < 1 pushes outward) — fan cone. */
function edgePush(u, k) {
  const h = Math.abs(u - 0.5) * 2;
  return u < 0.5 ? 0.5 - Math.pow(h, k) / 2 : 0.5 + Math.pow(h, k) / 2;
}

/**
 * One realistic sparkler burst. profile keys:
 *  salt        seed string (per-kind)
 *  nArms [a,b] primary arm count range
 *  len [a,b]   arm length as fraction of size
 *  segs        polyline segments per arm
 *  wander      max per-segment direction change (radians)
 *  angleJitter fan-out jitter (full-circle modes)
 *  cone        if set: sweep arms into a cone of this width (fan)
 *  coneEdgeArm edge-bias exponent for arm angles within the cone
 *  lowerBias   if true: weight angles to the lower hemisphere (gravity)
 *  branchProb / maxGen / branchDecay / branchLen / branchTwin / maxBranches
 *  armW [a,b]  stroke width fraction of size
 *  flickAmp / flickRate   per-arm brightness variance / phase reseed rate
 *  tipFade / fadeCurve    alpha falloff along length (1 - tipFade*t^curve)
 *  coolTips   lerp inner stroke white-hot -> dim orange along length (gravity)
 *  droop      gravity: y += droop*size*t^2 along arm param
 *  wind       global x drift: x += wind*size*t along arm param
 *  alongEmbers  embers per primary arm, spawned along the limb
 *  tipBiasEmber  constrain along-limb embers to the outer 45% (cone edge)
 *  tipEmberProb / tipR / tipAlpha  hot ember at each primary arm tip
 *  emberR [a,b] / emberAlpha / twinkle [a,b]  ember size/alpha/twinkle rate
 *  emberFall  gravity: embers drawn below the arm line (falling)
 *  coreScale / coreBright  hot core size & brightness multipliers
 */
function drawBurstBase(ctx, x, y, size, tint, phase, flick, prof) {
  const p = Number(phase) || 0;
  const rnd = mulberry32((hashStr(prof.salt) ^ Math.imul(Math.floor(p * prof.flickRate) + 1, 2654435761)) >>> 0);
  const n = prof.nArms[0] + Math.floor(rnd() * (prof.nArms[1] - prof.nArms[0] + 1));
  const coneC = prof.cone ? (rnd() - 0.5) * 0.5 : 0; // seeded rightward rotation for fan
  const limbs = [];
  let branchCount = 0;

  /* Grow one limb polyline; recursively spawn branches (gen 2/3). */
  const genLimb = (px, py, ang, len, gen, segs) => {
    const pts = [{ x: px, y: py }];
    let sx = px, sy = py, ca = ang;
    for (let s = 0; s < segs; s++) {
      const t = (s + 1) / segs;
      ca += (rnd() - 0.5) * prof.wander;
      sx += Math.cos(ca) * (len / segs);
      sy += Math.sin(ca) * (len / segs);
      pts.push({
        x: sx + (prof.wind ? prof.wind * size * t : 0),
        y: sy + (prof.droop ? prof.droop * size * t * t : 0),
      });
    }
    limbs.push({ pts, gen, len });
    if (gen < prof.maxGen) {
      const tries = 1 + (prof.branchTwin && rnd() < prof.branchTwin ? 1 : 0);
      for (let k = 0; k < tries; k++) {
        if (rnd() < prof.branchProb * (gen === 0 ? 1 : (prof.branchDecay || 0.75)) && branchCount < prof.maxBranches) {
          branchCount++;
          const t0 = 0.3 + rnd() * 0.55;
          const p0 = limbPoint(pts, t0);
          const side = rnd() < 0.5 ? -1 : 1;
          const bAng = p0.a + side * (0.35 + rnd() * 0.8) + (prof.droop ? 0.15 : 0);
          const bLen = len * (prof.branchLen[0] + rnd() * (prof.branchLen[1] - prof.branchLen[0])) * (gen === 0 ? 1 : 0.65);
          genLimb(p0.x, p0.y, bAng, bLen, gen + 1, 2);
        }
      }
    }
  };

  for (let i = 0; i < n; i++) {
    let a;
    if (prof.cone) {
      a = coneC + edgePush((i + rnd()) / n, prof.coneEdgeArm) * prof.cone - prof.cone / 2;
    } else if (prof.lowerBias) {
      a = -Math.PI * 0.32 + rnd() * Math.PI * 1.72 + (rnd() - 0.5) * 0.3;
    } else {
      a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * prof.angleJitter;
    }
    const len = size * (prof.len[0] + rnd() * (prof.len[1] - prof.len[0]));
    genLimb(x, y, a, len, 0, prof.segs);
  }

  /* Render: wide tinted pass + thin hot pass, alpha fading along length. */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const tips = [];
  for (const limb of limbs) {
    const genScale = limb.gen === 0 ? 1 : limb.gen === 1 ? 0.85 : 0.68;
    const w = Math.max(0.7, size * (prof.armW[0] + rnd() * (prof.armW[1] - prof.armW[0])));
    const bright = (0.55 + rnd() * prof.flickAmp) * genScale;
    const segs = limb.pts.length - 1;
    for (let s = 0; s < segs; s++) {
      const t = (s + 1) / segs;
      const alphaMul = (1 - prof.tipFade * Math.pow(t, prof.fadeCurve)) * bright * flick;
      if (alphaMul <= 0.01) continue;
      const a0 = limb.pts[s], a1 = limb.pts[s + 1];
      const wt = Math.max(0.5, w * (1 - 0.3 * t));
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.strokeStyle = rgba(tint, 0.3 * alphaMul);
      ctx.lineWidth = wt * 2.2;
      ctx.stroke();
      const innerC = prof.coolTips ? {
        r: Math.round(HOT_INNER.r + (COOL_TIP.r - HOT_INNER.r) * Math.pow(t, 1.2)),
        g: Math.round(HOT_INNER.g + (COOL_TIP.g - HOT_INNER.g) * Math.pow(t, 1.2)),
        b: Math.round(HOT_INNER.b + (COOL_TIP.b - HOT_INNER.b) * Math.pow(t, 1.2)),
      } : HOT_INNER;
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.strokeStyle = rgba(innerC, (prof.coolTips ? 0.7 : 0.75) * alphaMul);
      ctx.lineWidth = wt;
      ctx.stroke();
    }
    if (limb.gen === 0) tips.push(limb.pts[limb.pts.length - 1]);
  }

  /* Embers along limbs (spawned where the arm burns) + hot tips. */
  const alongTotal = Math.round(n * prof.alongEmbers);
  for (let i = 0; i < alongTotal; i++) {
    const limb = limbs[Math.floor(rnd() * limbs.length)];
    let t = rnd();
    if (prof.tipBiasEmber) t = 0.55 + t * 0.45; // fan: concentrate at cone edge
    const pt = limbPoint(limb.pts, t);
    const ex = pt.x + (rnd() - 0.5) * size * 0.02;
    let ey = pt.y + (rnd() - 0.5) * size * 0.015;
    if (prof.emberFall) ey += prof.emberFall * size * (0.3 + rnd() * 0.7) * (0.4 + t);
    const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(p * (prof.twinkle[0] + rnd() * (prof.twinkle[1] - prof.twinkle[0])) + rnd() * 6.28));
    drawEmber(ctx, ex, ey, size * (prof.emberR[0] + rnd() * (prof.emberR[1] - prof.emberR[0])), tint, prof.emberAlpha * tw);
  }
  for (const tip of tips) {
    if (rnd() < prof.tipEmberProb) {
      const tw = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(p * (prof.twinkle[0] + rnd() * 2) + rnd() * 6.28));
      drawEmber(ctx, tip.x, tip.y, size * (prof.tipR[0] + rnd() * (prof.tipR[1] - prof.tipR[0])), tint, prof.tipAlpha * tw);
    }
  }
  ctx.restore();
  drawCore(ctx, x, y, size * (prof.coreScale || 1), tint, flick * (prof.coreBright || 1));
}

/* ---------- head painters (6 realism variants) ---------- */

/* (1) classic — balanced burst: 14–20 arms, light gen-2 branching (~30%). */
const PROFILE_CLASSIC = {
  salt: 'burst-classic', nArms: [14, 20], len: [0.22, 0.66], segs: 3, wander: 0.55,
  angleJitter: 0.9,
  branchProb: 0.3, maxGen: 1, branchLen: [0.3, 0.55], branchTwin: 0, maxBranches: 14,
  armW: [0.008, 0.016], flickAmp: 0.45, flickRate: 9,
  tipFade: 0.25, fadeCurve: 1.2,
  alongEmbers: 0.55, tipEmberProb: 1, tipR: [0.008, 0.02], tipAlpha: 0.7,
  emberR: [0.006, 0.016], emberAlpha: 0.5, twinkle: [1.5, 4.5],
  droop: 0, wind: 0, emberFall: 0, coolTips: false,
  coreScale: 1, coreBright: 1,
};

/* (2) crackle — iron-file crackle: many short arms, aggressive gen-2+gen-3
 * branching, dense tiny embers along full arm length, tight flicker. */
const PROFILE_CRACKLE = {
  salt: 'burst-crackle', nArms: [18, 24], len: [0.13, 0.34], segs: 2, wander: 0.75,
  angleJitter: 1.2,
  branchProb: 0.72, maxGen: 2, branchDecay: 0.75, branchLen: [0.28, 0.6], branchTwin: 0.35, maxBranches: 60,
  armW: [0.005, 0.011], flickAmp: 0.45, flickRate: 22,
  tipFade: 0.45, fadeCurve: 1.3,
  alongEmbers: 2.6, tipEmberProb: 0.5, tipR: [0.004, 0.009], tipAlpha: 0.55,
  emberR: [0.003, 0.007], emberAlpha: 0.55, twinkle: [3, 7],
  coreScale: 0.95, coreBright: 1,
};

/* (3) trail — long fading streaks: few long arms, strong alpha falloff so tips
 * dim into the dark, sparse large slow embers. */
const PROFILE_TRAIL = {
  salt: 'burst-trail', nArms: [8, 12], len: [0.42, 0.7], segs: 5, wander: 0.34,
  angleJitter: 0.9,
  branchProb: 0.12, maxGen: 1, branchLen: [0.2, 0.35], branchTwin: 0, maxBranches: 6,
  armW: [0.006, 0.013], flickAmp: 0.35, flickRate: 7,
  tipFade: 0.96, fadeCurve: 1.7,
  alongEmbers: 0.3, tipEmberProb: 0.3, tipR: [0.01, 0.02], tipAlpha: 0.35,
  emberR: [0.012, 0.022], emberAlpha: 0.4, twinkle: [0.7, 1.8],
  coreScale: 0.9, coreBright: 1,
};

/* (4) dense — fresh-lit knot: small spray radius, very high arm count, hot
 * white-gold core larger than default, short arms, dense close-in embers. */
const PROFILE_DENSE = {
  salt: 'burst-dense', nArms: [26, 34], len: [0.09, 0.2], segs: 2, wander: 0.9,
  angleJitter: 1.4,
  branchProb: 0.3, maxGen: 1, branchLen: [0.25, 0.5], branchTwin: 0, maxBranches: 20,
  armW: [0.006, 0.012], flickAmp: 0.45, flickRate: 14,
  tipFade: 0.3, fadeCurve: 1.2,
  alongEmbers: 1.6, tipEmberProb: 0.85, tipR: [0.005, 0.012], tipAlpha: 0.7,
  emberR: [0.004, 0.01], emberAlpha: 0.6, twinkle: [2.5, 6],
  coreScale: 1.3, coreBright: 1,
};

/* (5) gravity — drooping burst: arms biased to the lower hemisphere, tips droop
 * with t^2 curvature, embers fall (drawn below the arm line), cooling tips,
 * asymmetric glow (extra backdrop pulled downward). */
const PROFILE_GRAVITY = {
  salt: 'burst-gravity', nArms: [12, 17], len: [0.22, 0.55], segs: 4, wander: 0.5,
  angleJitter: 0.9, lowerBias: true,
  branchProb: 0.25, maxGen: 1, branchLen: [0.25, 0.5], branchTwin: 0, maxBranches: 14,
  armW: [0.007, 0.014], flickAmp: 0.45, flickRate: 10,
  tipFade: 0.8, fadeCurve: 1.5, coolTips: true,
  droop: 0.26,
  alongEmbers: 0.8, tipEmberProb: 0.7, tipR: [0.007, 0.016], tipAlpha: 0.5,
  emberR: [0.006, 0.013], emberAlpha: 0.5, twinkle: [1.5, 4], emberFall: 0.05,
  coreScale: 1, coreBright: 0.95,
};

/* (6) fan — wind-blown fan: all arms swept into a ~120° rightward cone (seeded
 * rotation), arms wander, embers concentrated at the cone edge. */
const PROFILE_FAN = {
  salt: 'burst-fan', nArms: [12, 16], len: [0.28, 0.6], segs: 4, wander: 0.6,
  cone: Math.PI * (2 / 3), coneEdgeArm: 0.85, tipBiasEmber: true,
  branchProb: 0.18, maxGen: 1, branchLen: [0.2, 0.4], branchTwin: 0, maxBranches: 10,
  armW: [0.007, 0.014], flickAmp: 0.45, flickRate: 11,
  tipFade: 0.55, fadeCurve: 1.4,
  alongEmbers: 1.1, tipEmberProb: 0.8, tipR: [0.007, 0.015], tipAlpha: 0.6,
  emberR: [0.005, 0.012], emberAlpha: 0.5, twinkle: [2, 5],
  wind: 0.05,
  coreScale: 1, coreBright: 1,
};

function drawClassic(ctx, x, y, size, tint, phase, flick) {
  drawBurstBase(ctx, x, y, size, tint, phase, flick, PROFILE_CLASSIC);
}

function drawCrackle(ctx, x, y, size, tint, phase, flick) {
  drawBurstBase(ctx, x, y, size, tint, phase, flick, PROFILE_CRACKLE);
}

function drawTrail(ctx, x, y, size, tint, phase, flick) {
  drawBurstBase(ctx, x, y, size, tint, phase, flick, PROFILE_TRAIL);
}

function drawDense(ctx, x, y, size, tint, phase, flick) {
  drawBurstBase(ctx, x, y, size, tint, phase, flick, PROFILE_DENSE);
}

function drawGravity(ctx, x, y, size, tint, phase, flick) {
  drawGlowBackdrop(ctx, x, y + size * 0.16, size * 0.85, tint, 0.5, flick); // asymmetric glow
  drawBurstBase(ctx, x, y, size, tint, phase, flick, PROFILE_GRAVITY);
}

function drawFan(ctx, x, y, size, tint, phase, flick) {
  drawBurstBase(ctx, x, y, size, tint, phase, flick, PROFILE_FAN);
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
 * @param {'classic'|'crackle'|'trail'|'dense'|'gravity'|'fan'|'upload'} kind
 * @param {number} x center x
 * @param {number} y center y
 * @param {number} size nominal diameter (scale-invariant drawing)
 * @param {object} [opts] {tint, glow 0..1, opacity 0..1, flickerPhase, image}
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
    case 'crackle': drawCrackle(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
    case 'trail': drawTrail(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
    case 'dense': drawDense(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
    case 'gravity': drawGravity(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
    case 'fan': drawFan(ctx, x, y, s, tint, opts.flickerPhase, flick); break;
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
/*!
 * editor.js — Sparkler Head Editor (P2 engine module, Sparkler Exit Lab)
 *
 * Layer model: { kind, x, y, size, rotation, tint, glow, opacity, flicker, id }
 *   - x, y: fraction of image width / height (0..1) — resolution independent
 *   - size: head diameter as a fraction of image width (e.g. 0.12)
 *   - rotation: radians; tint: '#rrggbb'; glow/opacity: 0..100 control units
 *
 * Contracts assumed (per SPEC + parallel modules):
 *   - app.js sets window.__sparklerLab.imageDataUrl / imageBitmap and fires
 *     'sparklerlab:image-loaded' (this module listens on window AND document).
 *   - heads.js exports drawHead(ctx, kind, x, y, size, opts) and applies
 *     opacity itself via ctx.globalAlpha; opts here pass tint plus
 *     glow/opacity NORMALIZED to 0..1 (verified against heads.js contract),
 *     flickerPhase (seconds) and image for kind 'upload'. Blend and the
 *     ctx translate/rotate are applied by this module.
 */
import { drawHead } from './heads.js';
import { showToast } from './toast.js';

const LS_KEY = 'sparklerLabEditor';
const MAX_STACK = 50;
const MAX_DISPLAY_W = 1600;
const DEF_SIZE = 0.12;
const MIN_SIZE = 0.02;
const MAX_SIZE = 1.0;
const LONG_PRESS_MS = 600;
const DBL_GUARD_MS = 600;
const DRAG_CANCEL_PX = 8;

const $ = (id) => document.getElementById(id);
const clampNum = (v, lo, hi, dflt) => {
  const n = +v;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function initEditor() {
  const canvas = $('editorCanvas');
  const stage = $('stage');
  const stageEmpty = $('stageEmpty');
  const headSelect = $('headSelect');
  const blendSelect = $('blendSelect');
  const glowRange = $('glowRange');
  const tintColor = $('tintColor');
  const opacityRange = $('opacityRange');
  const flickerToggle = $('flickerToggle');
  const undoBtn = $('undoBtn');
  const redoBtn = $('redoBtn');
  const baToggle = $('baToggle');
  const exportBtn = $('exportBtn');
  const exportJpgBtn = $('exportJpgBtn');
  const resetBtn = $('resetBtn');
  const headFileInput = $('headFileInput');
  if (!canvas || !stage) return;

  const reducedMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const drawErrors = new Set();
  if (canvas) canvas.hidden = true; // blank 960x640 box until a photo arrives

  /* ---------------- state ---------------- */
  const defaults = { kind: 'classic', blend: 'screen', glow: 60, tint: '#ffb347', opacity: 100, flicker: true };
  let layers = [];
  let selectedId = null;
  let baseSource = null;      // source-resolution canvas (for export)
  let baseW = 0, baseH = 0;
  let uploadImage = null;     // HTMLImageElement for kind 'upload'
  let uploadPending = null;   // pending placement point while picker is open
  let undoStack = [], redoStack = [];
  let saveTimer = 0;
  let ctlSnapshot = null;
  let drag = null;
  let lpTimer = 0;
  let lastPlacedId = null, lastPlacedAt = 0;
  let baHeld = false, baSplit = false;
  let rafId = 0;
  let lastUrlLoaded = null;
  let lastBitmapLoaded = null; // R9a: mirror of lastUrlLoaded for the bitmap path

  const sel = () => layers.find((l) => l.id === selectedId);
  const layersJson = () => JSON.stringify(layers);

  /* ---------------- render loop ---------------- */
  function flickerActive() {
    return !reducedMotion && defaults.flicker && layers.some((l) => l.flicker);
  }
  function tick(t) {
    rafId = 0;
    render(t / 1000);
    if (flickerActive()) rafId = requestAnimationFrame(tick);
  }
  function requestRender() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function drawLayer(ctx, L, W, H, phase) {
    ctx.save();
    ctx.globalCompositeOperation =
      L.blend === 'normal' ? 'source-over' : (L.blend === 'lighten' ? 'lighten' : 'screen');
    ctx.translate(L.x * W, L.y * H);
    ctx.rotate(L.rotation || 0);
    try {
      drawHead(ctx, L.kind, 0, 0, L.size * W, {
        tint: L.tint,
        glow: clampNum(L.glow, 0, 100, 60) / 100,       // heads.js expects 0..1
        opacity: clampNum(L.opacity, 10, 100, 100) / 100, // heads.js expects 0..1
        flickerPhase: phase || 0,
        image: L.kind === 'upload' ? uploadImage : null
      });
    } catch (err) {
      if (!drawErrors.has(L.kind)) {
        drawErrors.add(L.kind);
        console.warn('[editor] drawHead failed for kind "' + L.kind + '":', err);
      }
    }
    ctx.restore();
  }

  function drawSelection(ctx, L, W, H) {
    const cx = L.x * W, cy = L.y * H;
    const r = Math.max(L.size * W * 0.5, 14);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const hx = cx + Math.cos(L.rotation || 0) * (r + 4);
    const hy = cy + Math.sin(L.rotation || 0) * (r + 4);
    ctx.fillStyle = '#7ec8ff';
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render(phase) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, W, H);
    if (!baseSource) return;
    ctx.drawImage(baseSource, 0, 0, W, H);
    if (!baHeld) for (const L of layers) drawLayer(ctx, L, W, H, phase);
    if (!baHeld && selectedId) {
      const s = sel();
      if (s) drawSelection(ctx, s, W, H);
    }
    if (baSplit) {
      // Persistent before/after split: original on the left, edited on the right.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Math.round(W / 2), H);
      ctx.clip();
      ctx.drawImage(baseSource, 0, 0, W, H);
      ctx.restore();
      ctx.fillStyle = 'rgba(126,200,255,0.9)';
      ctx.fillRect(Math.round(W / 2) - 1.5, 0, 3, H);
    }
  }

  /* ---------------- image pipeline ---------------- */
  function loadEditorImage(src) {
    const sw = src.naturalWidth || src.width;
    const sh = src.naturalHeight || src.height;
    if (!sw || !sh) { console.warn('[editor] image has no dimensions; ignoring'); return; }
    baseSource = document.createElement('canvas');
    baseSource.width = sw;
    baseSource.height = sh;
    baseSource.getContext('2d').drawImage(src, 0, 0);
    baseW = sw; baseH = sh;
    const scale = Math.min(1, MAX_DISPLAY_W / sw); // display never exceeds source resolution
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    canvas.hidden = false;
    stage.hidden = false;
    stage.style.display = '';
    if (stageEmpty) stageEmpty.hidden = true;
    requestRender();
  }

  function onImageLoaded(ev) {
    const lab = (window.__sparklerLab = window.__sparklerLab || {});
    const detail = (ev && ev.detail) || {};
    const url = lab.imageDataUrl || detail.imageDataUrl || detail.url || null;
    if (lab.imageBitmap) {
      if (lab.imageBitmap === lastBitmapLoaded) return; // R9a: duplicate dispatch guard (window+document)
      lastBitmapLoaded = lab.imageBitmap;
      lastUrlLoaded = url || null; // remember it so a later same-dataURL dispatch skips the rebuild
      loadEditorImage(lab.imageBitmap);
      return;
    }
    if (!url) return;
    if (url === lastUrlLoaded) return; // duplicate dispatch (window+document) guard
    lastUrlLoaded = url;
    const img = new Image();
    img.onload = () => loadEditorImage(img);
    img.onerror = () => { lastUrlLoaded = null; console.warn('[editor] lab photo failed to decode'); };
    img.src = url;
  }
  window.addEventListener('sparklerlab:image-loaded', onImageLoaded);
  document.addEventListener('sparklerlab:image-loaded', onImageLoaded);
  // Module may load after app.js already provided an image.
  if (window.__sparklerLab && (window.__sparklerLab.imageBitmap || window.__sparklerLab.imageDataUrl)) {
    onImageLoaded();
  }

  /* ---------------- helpers ---------------- */
  function eventToPoint(e) {
    const r = canvas.getBoundingClientRect();
    return {
      fx: (e.clientX - r.left) / r.width,
      fy: (e.clientY - r.top) / r.height,
      px: (e.clientX - r.left) * (canvas.width / r.width),
      py: (e.clientY - r.top) * (canvas.height / r.height)
    };
  }

  function layerAt(p) {
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      const r = Math.max(L.size * canvas.width * 0.5, 14);
      if (dist(p.px, p.py, L.x * canvas.width, L.y * canvas.height) <= r) return L;
    }
    return null;
  }

  function nextId() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function addLayerAt(fx, fy, beforeJson) {
    const L = {
      kind: defaults.kind,
      x: clampNum(fx, -0.05, 1.05, 0.5),
      y: clampNum(fy, -0.05, 1.05, 0.5),
      size: DEF_SIZE,
      rotation: 0,
      blend: defaults.blend,
      tint: defaults.tint,
      glow: defaults.glow,
      opacity: defaults.opacity,
      flicker: defaults.flicker,
      id: nextId()
    };
    layers.push(L);
    selectedId = L.id;
    lastPlacedId = L.id;
    lastPlacedAt = performance.now();
    pushUndo(beforeJson);
    requestRender();
    scheduleSave();
    return L;
  }

  function deleteLayer(id) {
    const i = layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    const before = JSON.stringify(layers);
    layers.splice(i, 1);
    if (selectedId === id) selectedId = null;
    if (lastPlacedId === id) lastPlacedId = null;
    drag = null;
    clearTimeout(lpTimer); lpTimer = 0;
    pushUndo(before);
    requestRender();
    scheduleSave();
  }

  /* ---------------- undo / redo ---------------- */
  function updateHistory() {
    if (undoBtn) undoBtn.disabled = !undoStack.length;
    if (redoBtn) redoBtn.disabled = !redoStack.length;
  }
  function pushUndo(beforeJson) {
    if (beforeJson == null || beforeJson === layersJson()) return;
    undoStack.push(beforeJson);
    if (undoStack.length > MAX_STACK) undoStack.shift();
    redoStack.length = 0;
    updateHistory();
  }
  function restoreState(json) {
    try {
      const arr = JSON.parse(json);
      layers = Array.isArray(arr) ? arr : [];
    } catch { layers = []; }
    if (selectedId && !layers.some((l) => l.id === selectedId)) selectedId = null;
    lastPlacedId = null;
    updateHistory();
    requestRender();
    scheduleSave();
  }
  function doUndo() {
    if (!undoStack.length) return;
    const before = undoStack.pop();
    redoStack.push(layersJson());
    if (redoStack.length > MAX_STACK) redoStack.shift();
    restoreState(before);
  }
  function doRedo() {
    if (!redoStack.length) return;
    const next = redoStack.pop();
    undoStack.push(layersJson());
    if (undoStack.length > MAX_STACK) undoStack.shift();
    restoreState(next);
  }
  if (undoBtn) undoBtn.addEventListener('click', doUndo);
  if (redoBtn) redoBtn.addEventListener('click', doRedo);

  /* ---------------- pointer interaction ---------------- */
  function cancelLongPress() {
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = 0; }
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    if (!baseSource || drag) return;
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* older engines */ }
    const p = eventToPoint(e);
    const s = sel();
    if (s) {
      const r = Math.max(s.size * canvas.width * 0.5, 14) + 4;
      const hx = s.x * canvas.width + Math.cos(s.rotation || 0) * r;
      const hy = s.y * canvas.height + Math.sin(s.rotation || 0) * r;
      if (dist(p.px, p.py, hx, hy) <= 22) {
        drag = {
          mode: 'handle', id: s.id, before: layersJson(),
          d0: Math.max(dist(p.px, p.py, s.x * canvas.width, s.y * canvas.height), 1),
          size0: s.size
        };
        return;
      }
    }
    const hit = layerAt(p);
    if (hit) {
      selectedId = hit.id;
      drag = {
        mode: 'move', id: hit.id, before: layersJson(),
        ox: p.px - hit.x * canvas.width, oy: p.py - hit.y * canvas.height,
        sx: p.px, sy: p.py
      };
      clearTimeout(lpTimer);
      lpTimer = setTimeout(() => {
        lpTimer = 0;
        drag = null;
        deleteLayer(hit.id);
      }, LONG_PRESS_MS);
      requestRender();
      scheduleSave();
      return;
    }
    if (defaults.kind === 'upload' && !uploadImage) {
      uploadPending = { fx: p.fx, fy: p.fy };
      if (headFileInput) headFileInput.click();
      return;
    }
    const before = layersJson();
    drag = { mode: 'move', id: null, before, ox: 0, oy: 0 };
    const L = addLayerAt(p.fx, p.fy, before);
    drag = {
      mode: 'move', id: L.id, before, ox: 0, oy: 0,
      sx: p.px, sy: p.py, pushedByAdd: true
    };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const L = layers.find((l) => l.id === drag.id);
    if (!L) { drag = null; return; }
    e.preventDefault();
    const p = eventToPoint(e);
    if (drag.mode === 'move') {
      if (lpTimer && dist(p.px, p.py, drag.sx, drag.sy) > 8) { clearTimeout(lpTimer); lpTimer = 0; }
      L.x = clampNum((p.px - drag.ox) / canvas.width, -0.05, 1.05, L.x);
      L.y = clampNum((p.py - drag.oy) / canvas.height, -0.05, 1.05, L.y);
      requestRender();
    } else if (drag.mode === 'handle') {
      const cx = L.x * canvas.width, cy = L.y * canvas.height;
      const dx = p.px - cx, dy = p.py - cy;
      const d = Math.max(Math.hypot(dx, dy), 1);
      L.rotation = Math.atan2(dy, dx);
      L.size = clampNum(drag.size0 * (d / drag.d0), MIN_SIZE, MAX_SIZE, L.size);
      requestRender();
    }
  });

  function endPointer(e) {
    cancelLongPress();
    if (!drag) return;
    if (drag.id) {
      const nowJson = layersJson();
      if (nowJson !== drag.before && !drag.pushedByAdd) { pushUndo(drag.before); scheduleSave(); }
    }
    drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('dblclick', (e) => {
    if (!baseSource) return;
    e.preventDefault();
    const p = eventToPoint(e);
    const hit = layerAt(p);
    if (hit && !(hit.id === lastPlacedId && performance.now() - lastPlacedAt < DBL_GUARD_MS)) {
      deleteLayer(hit.id);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancelLongPress();
      drag = null;
      if (selectedId != null) { selectedId = null; requestRender(); }
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); doRedo(); }
  });

  /* ---------------- live controls ---------------- */
  function bindControl(el, apply) {
    if (!el) return;
    el.addEventListener('input', () => {
      if (!ctlSnapshot) ctlSnapshot = layersJson();
      apply();
      requestRender();
      scheduleSave();
    });
    el.addEventListener('change', () => {
      if (ctlSnapshot) { pushUndo(ctlSnapshot); ctlSnapshot = null; }
      scheduleSave();
    });
  }
  bindControl(blendSelect, () => {
    defaults.blend = blendSelect.value;
    const s = sel(); if (s) s.blend = defaults.blend;
  });
  bindControl(glowRange, () => {
    defaults.glow = clampNum(glowRange.value, 0, 100, 60);
    const s = sel(); if (s) s.glow = defaults.glow;
  });
  bindControl(tintColor, () => {
    defaults.tint = tintColor.value;
    const s = sel(); if (s) s.tint = defaults.tint;
  });
  bindControl(opacityRange, () => {
    defaults.opacity = clampNum(opacityRange.value, 10, 100, 100);
    const s = sel(); if (s) s.opacity = defaults.opacity;
  });
  bindControl(flickerToggle, () => {
    defaults.flicker = !!flickerToggle.checked;
    const s = sel(); if (s) s.flicker = defaults.flicker;
  });
  if (headSelect) {
    headSelect.addEventListener('change', () => {
      defaults.kind = headSelect.value;
      if (defaults.kind === 'upload' && !uploadImage && headFileInput) headFileInput.click();
      scheduleSave();
    });
  }

  // Uploaded head PNG/webp (transparency preserved by canvas).
  if (headFileInput) {
    headFileInput.addEventListener('change', () => {
      const f = headFileInput.files && headFileInput.files[0];
      headFileInput.value = ''; // allow re-selecting the same file
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          uploadImage = img;
          if (uploadPending) { addLayerAt(uploadPending.fx, uploadPending.fy, layersJson()); uploadPending = null; }
          requestRender();
        };
        img.onerror = () => console.warn('[editor] head image failed to decode');
        img.src = String(rd.result);
      };
      rd.onerror = () => console.warn('[editor] head file read failed');
      rd.readAsDataURL(f);
    });
  }

  /* ---------------- before / after ---------------- */
  // Model: press-and-hold previews the original (heads hidden); release restores.
  // A short click (<300ms) toggles a persistent 50% before/after split instead.
  // Keyboard (Enter/Space fires click without pointerdown) also toggles the split.
  let baDownAt = 0;
  if (baToggle) {
    const isPointer = (e) => e && typeof e.pointerId === 'number' && e.pointerId >= 0;
    baToggle.addEventListener('pointerdown', (e) => {
      if (!baseSource) return;
      e.preventDefault();
      baDownAt = performance.now();
      baHeld = true;
      baToggle.setAttribute('aria-pressed', 'true');
      requestRender();
    });
    const releaseBa = (e) => {
      if (!baHeld) return;
      baHeld = false;
      const wasClick = performance.now() - baDownAt < 300 && isPointer(e);
      baToggle.setAttribute('aria-pressed', 'false');
      if (wasClick) { // short click toggles the persistent split
        baSplit = !baSplit;
        baToggle.setAttribute('aria-pressed', String(baSplit));
      }
      requestRender();
    };
    baToggle.addEventListener('pointerup', releaseBa);
    baToggle.addEventListener('pointercancel', releaseBa);
    window.addEventListener('pointerup', releaseBa);
    window.addEventListener('pointercancel', releaseBa);
    baToggle.addEventListener('click', (e) => {
      // pointer-initiated clicks are handled in releaseBa; keyboard clicks fall through
      if (e && e.pointerType) return;
      if (!baseSource) return;
      baSplit = !baSplit;
      baToggle.setAttribute('aria-pressed', String(baSplit));
      requestRender();
    });
  }

  /* ---------------- reset ---------------- */
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!layers.length) return;
      const before = layersJson();
      layers = [];
      selectedId = null;
      lastPlacedId = null;
      pushUndo(before);
      requestRender();
      scheduleSave();
    });
  }

  /* ---------------- export ---------------- */
  function renderToOffscreen() {
    if (!baseSource) { console.warn('[editor] export: no photo loaded'); return null; }
    const off = document.createElement('canvas');
    off.width = baseW;   // FULL source resolution; never upscaled beyond source
    off.height = baseH;
    console.assert(off.width <= baseW && off.height <= baseH,
      '[editor] export must not exceed source resolution');
    const c = off.getContext('2d');
    c.setLineDash([]);
    c.drawImage(baseSource, 0, 0);
    for (const L of layers) drawLayer(c, L, off.width, off.height, 0);
    return off;
  }
  function triggerDownload(blob, fallbackHref, fallbackName) {
    const a = document.createElement('a');
    if (blob && typeof URL !== 'undefined' && URL.createObjectURL) {
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, 2000);
      return;
    }
    a.href = fallbackHref;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!baseSource) { console.warn('[editor] export: no photo loaded'); return; }
      const off = renderToOffscreen();
      if (!off) return;
      if (typeof off.toBlob === 'function') {
        off.toBlob((blob) => {
          if (blob) {
            triggerDownload(blob, null, 'sparkler-exit-lab.png');
          } else {
            triggerDownload(null, off.toDataURL('image/png'), 'sparkler-exit-lab.png');
          }
        }, 'image/png');
      } else {
        triggerDownload(null, off.toDataURL('image/png'), 'sparkler-exit-lab.png');
      }
    });
  }
  // JPEG export: quality 1.0 = maximum quality the JPEG format allows
  // (no chroma subsampling where the browser honors it, full-length quantization tables).
  // PNG stays the lossless option; JPEG keeps photos small with no visible loss at q1.0.
  if (exportJpgBtn) {
    exportJpgBtn.addEventListener('click', () => {
      if (!baseSource) { console.warn('[editor] export: no photo loaded'); return; }
      const off = renderToOffscreen();
      if (!off) return;
      if (typeof off.toBlob === 'function') {
        off.toBlob((blob) => {
          if (blob) {
            triggerDownload(blob, null, 'sparkler-exit-lab.jpg');
          } else {
            triggerDownload(null, off.toDataURL('image/jpeg', 1.0), 'sparkler-exit-lab.jpg');
          }
        }, 'image/jpeg', 1.0);
      } else {
        triggerDownload(null, off.toDataURL('image/jpeg', 1.0), 'sparkler-exit-lab.jpg');
      }
    });
  }

  /* ---------------- persistence ---------------- */
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  }
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        layers,
        controls: {
          kind: headSelect ? headSelect.value : defaults.kind,
          blend: blendSelect ? blendSelect.value : defaults.blend,
          glow: glowRange ? +glowRange.value : defaults.glow,
          tint: tintColor ? tintColor.value : defaults.tint,
          opacity: opacityRange ? +opacityRange.value : defaults.opacity,
          flicker: flickerToggle ? !!flickerToggle.checked : defaults.flicker
        }
      }));
    } catch { /* storage unavailable */ }
  }
  function syncDefaults() {
    defaults.kind = headSelect ? headSelect.value : 'classic';
    defaults.blend = blendSelect ? blendSelect.value : 'screen';
    defaults.glow = glowRange ? clampNum(glowRange.value, 0, 100, 60) : 60;
    defaults.tint = tintColor ? tintColor.value : '#ffb347';
    defaults.opacity = opacityRange ? clampNum(opacityRange.value, 10, 100, 100) : 100;
    defaults.flicker = flickerToggle ? !!flickerToggle.checked : true;
  }
  function sanitizeLayer(L) {
    if (!L || typeof L !== 'object') return null;
    return {
      kind: String(L.kind || 'classic'),
      x: clampNum(L.x, -0.05, 1.05, 0.5),
      y: clampNum(L.y, -0.05, 1.05, 0.5),
      size: clampNum(L.size, MIN_SIZE, MAX_SIZE, DEF_SIZE),
      rotation: clampNum(L.rotation, -Math.PI * 4, Math.PI * 4, 0),
      blend: (L.blend === 'lighten' || L.blend === 'normal') ? L.blend : 'screen',
      tint: typeof L.tint === 'string' ? L.tint : '#ffb347',
      glow: clampNum(L.glow, 0, 100, 60),
      opacity: clampNum(L.opacity, 10, 100, 100),
      flicker: !!L.flicker,
      id: String(L.id || nextId())
    };
  }
  function restore() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!d) return;
      if (Array.isArray(d.layers)) {
        layers = d.layers.map(sanitizeLayer).filter(Boolean);
      }
      if (d.controls && typeof d.controls === 'object') {
        const c = d.controls;
        if (headSelect && c.kind) {
          try { headSelect.value = String(c.kind); } catch { /* bad value */ }
        }
        if (blendSelect && c.blend) {
          try { blendSelect.value = String(c.blend); } catch { /* bad value */ }
        }
        if (glowRange && Number.isFinite(+c.glow)) glowRange.value = clampNum(c.glow, 0, 100, 60);
        if (tintColor && typeof c.tint === 'string' && /^#[0-9a-f]{6}$/i.test(c.tint)) tintColor.value = c.tint;
        if (opacityRange && Number.isFinite(+c.opacity)) opacityRange.value = clampNum(c.opacity, 10, 100, 100);
        if (flickerToggle && typeof c.flicker === 'boolean') flickerToggle.checked = c.flicker;
      }
      syncDefaults();
    } catch { /* corrupt storage */ }
  }
  restore();
  updateHistory();

  /* ---------------- gallery samples ---------------- */
  document.querySelectorAll('.sample-open').forEach((btn) => {
    if (btn.dataset.editorBound) return;
    btn.dataset.editorBound = '1';
    btn.addEventListener('click', async () => {
      const name = btn.dataset.sample || btn.getAttribute('data-sample');
      if (!name) return;
      let url = 'assets/img/sample-' + name + '.jpg';
      try { url = new URL(url, document.baseURI).href; } catch { /* keep relative */ }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        const dataUrl = await new Promise((ok, bad) => {
          const r = new FileReader();
          r.onload = () => ok(r.result);
          r.onerror = bad;
          r.readAsDataURL(blob);
        });
        const lab = (window.__sparklerLab = window.__sparklerLab || {});
        lab.imageDataUrl = dataUrl;
        delete lab.imageBitmap;
        lastBitmapLoaded = null; // R9a: new image on the url path - allow its rebuild
        lab.sampleName = name;
        const ev = new CustomEvent('sparklerlab:image-loaded', { detail: { sample: name, imageDataUrl: dataUrl } });
        window.dispatchEvent(ev);
        document.dispatchEvent(ev);
        const ed = document.getElementById('s4editor');
        if (ed && typeof ed.scrollIntoView === 'function') {
          ed.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        }
      } catch (err) {
        console.warn('[editor] sample "' + name + '" failed to load:', err);
      }
    });
  });

  /* ---------------- R2: head-library cards are clickable ---------------- */
  document.querySelectorAll('#s3heads .headCard').forEach((card) => {
    if (card.dataset.headBound) return;
    card.dataset.headBound = '1';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Select ' + (card.querySelector('.headName') || {}).textContent + ' head');
    const selectHead = () => {
      const thumb = card.querySelector('.thumb');
      const kind = thumb ? thumb.getAttribute('data-head') : null;
      if (!kind || !headSelect || !headSelect.querySelector('option[value="' + kind + '"]')) return;
      headSelect.value = kind;
      defaults.kind = kind;
      headSelect.dispatchEvent(new Event('change', { bubbles: true }));
      const ed = document.getElementById('s4editor');
      if (ed && typeof ed.scrollIntoView === 'function') {
        ed.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
      showToast('HEAD selected - click a wand tip');
    };
    card.addEventListener('click', selectHead);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectHead(); }
    });
  });

  /* ---------------- QA hook ---------------- */
  window.__sparklerEditor = {
    state: () => layers,
    selected: () => selectedId,
    baseSize: () => (baseSource ? { w: baseW, h: baseH } : null)
  };
}

try {
  initEditor();
} catch (err) {
  console.warn('[editor] init failed:', err);
}
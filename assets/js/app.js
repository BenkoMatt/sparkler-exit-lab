/*! app.js — Sparkler Exit Lab lab wiring (P2 engine wave, app child)
 *  Plain ES2020 module. No deps, no build step. Owns: file intake, HEIC notice,
 *  EXIF card population, camera capture dialog, image decode, sample loading,
 *  'sparklerlab:image-loaded' dispatch. analyze.js/editor.js react via that event.
 *
 *  Bundle contract (also consumed by analyze.js): window.__sparklerLab =
 *    { source, imageBitmap, imageDataUrl, exif, fileName, mime, width, height }
 */

import { showToast } from './toast.js';

const SAMPLE_DIR = 'assets/img/';
const DEFAULT_SAMPLE = 'sample-tunnel-drag.jpg';
const NO_EXIF_TEXT = 'No EXIF data found - that is fine, analysis still works.';
const HEIC_TEXT = 'HEIC detected - convert to JPEG first (not supported outside Safari).';
const CAMERA_FALLBACK_TEXT = 'Camera unavailable or permission denied - pick a photo instead.';

const lab = { stream: null, overlay: null, keyHandler: null };

/* ============================ boot ============================ */

function boot() {
  try {
    wireFilePicker();
    wireDropzone();
    wireCamera();
    wireSamples();
    wireSendToEditor();
    // #s2lab deep link: samples are handled by their own modules - offer nothing extra here.
    if (typeof location !== 'undefined' && location.hash === '#s2lab' &&
        !(typeof window !== 'undefined' && window.__sparklerLab && window.__sparklerLab.imageDataUrl)) {
      /* intentional no-op */
    }
    // defensive: engine modules self-register, but make sure their listeners exist
    // even if the assembler did not emit their script tags (import cache dedupes).
    for (const mod of ['./analyze.js', './heads.js', './editor.js']) {
      import(mod).catch(() => { /* module owner handles absence */ });
    }
  } catch (e) {
    console.error('[app] boot failed:', e);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}

/* ============================ file intake ============================ */

function wireFilePicker() {
  const fileBtn = document.getElementById('fileBtn');
  const fileInput = document.getElementById('fileInput');
  if (fileBtn && fileInput) {
    fileBtn.addEventListener('click', () => {
      try { fileInput.click(); } catch (e) { console.error('[app] file picker failed:', e); }
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) handleFile(file);
      fileInput.value = ''; // allow re-picking the same file
    });
  }
}

function wireDropzone() {
  const dz = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  if (!dz) return;
  if (dz && fileInput) {
    dz.addEventListener('click', (e) => {
      // buttons inside the dropzone handle themselves
      if (e.target && e.target.closest && e.target.closest('button, input, a')) return;
      try { fileInput.click(); } catch (err) { console.error('[app] file picker failed:', err); }
    });
  }
  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer && (e.dataTransfer.dropEffect = 'copy');
    dz.classList.add('is-dragover', 'dragover');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('is-dragover', 'dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('is-dragover', 'dragover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

function isHeic(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'image/heic' || type === 'image/heif' ||
    name.endsWith('.heic') || name.endsWith('.heif');
}

/** Entry point for every image source: File/Blob -> buffer + dataURL -> pipeline. */
function handleFile(file) {
  try {
    if (isHeic(file)) {
      showCardNotice(HEIC_TEXT, true);
      return;
    }
    readAsArrayBuffer(file).then(
      (buffer) => {
        try {
          loadIntoPipeline({
            buffer,
            dataUrl: null,
            fileName: file.name || 'photo',
            mime: file.type || guessMime(file.name)
          });
        } catch (e) { console.error('[app] intake failed:', e); }
      },
      (e) => console.error('[app] could not read file:', (file && file.name) || 'unknown', e)
    );
  } catch (e) {
    console.error('[app] file handling failed:', e);
  }
}

/* Promise wrapper: FileReader where present, blob.arrayBuffer() fallback elsewhere. */
function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    try {
      if (file.arrayBuffer && typeof file.arrayBuffer === 'function') {
        file.arrayBuffer().then(resolve, reject);
        return;
      }
      if (typeof FileReader !== 'undefined') {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('read failed'));
        reader.onload = () => resolve(reader.result);
        reader.readAsArrayBuffer(file);
        return;
      }
      reject(new Error('no way to read file bytes'));
    } catch (e) { reject(e); }
  });
}

function guessMime(name) {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/* ============================ EXIF card ============================ */

function showCardNotice(text, isProblem) {
  const card = document.getElementById('exifCard');
  if (!card) return;
  clearBelowHeading(card);
  const p = document.createElement('p');
  p.className = 'empty-state';
  if (isProblem) { p.style.color = 'var(--bad, #ff6b6b)'; p.style.fontStyle = 'normal'; }
  p.textContent = text;
  card.appendChild(p);
}

function clearBelowHeading(card) {
  const keep = card.querySelector('h3');
  card.textContent = '';
  if (keep) card.appendChild(keep);
}

function renderExifCard(exif, fileName) {
  const card = document.getElementById('exifCard');
  if (!card) return;
  try {
    clearBelowHeading(card);
    const raw = (exif && exif.raw) || {};
    const hasAny = exif && (exif.shutter || exif.iso !== null || exif.aperture ||
      exif.flashFired !== null || Object.keys(raw).length > 0);
    if (!hasAny) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = NO_EXIF_TEXT;
      card.appendChild(p);
      return;
    }
    if (fileName) {
      const fn = document.createElement('p');
      fn.className = 'exif-file';
      fn.textContent = fileName;
      fn.style.color = 'var(--muted, #9aa0ae)';
      fn.style.fontSize = '0.8rem';
      fn.style.margin = '0 0 0.5rem';
      card.appendChild(fn);
    }
    const dl = document.createElement('dl');
    dl.style.margin = '0';
    dl.style.display = 'grid';
    dl.style.gridTemplateColumns = 'auto 1fr';
    dl.style.gap = '0.25rem 1rem';
    dl.style.fontSize = '0.92rem';
    const rows = [
      ['Shutter', exif.shutter || '—'],
      ['ISO', exif.iso !== null ? String(exif.iso) : '—'],
      ['Aperture', exif.aperture || '—'],
      ['Flash', exif.flashFired === null ? '—' : (exif.flashFired ? 'Fired' : 'Did not fire')]
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      dt.style.color = 'var(--muted, #9aa0ae)';
      const dd = document.createElement('dd');
      dd.textContent = v;
      dd.style.margin = '0';
      dd.style.fontVariantNumeric = 'tabular-nums';
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    card.appendChild(dl);
  } catch (e) {
    console.error('[app] exif card render failed:', e);
  }
}

/* ============================ pipeline ============================ */

/** Single funnel: any source lands here, decodes, publishes the bundle + event. */
async function loadIntoPipeline({ buffer, dataUrl, fileName, mime }) {
  try {
    let exif = null;
    if (buffer) {
      // dynamic import keeps exif.js optional at parse time (defensive degradation)
      try {
        const mod = await import('./exif.js');
        exif = mod.parseExif(buffer);
      } catch (e) {
        console.error('[app] exif module unavailable:', e);
        exif = { shutter: null, iso: null, aperture: null, flashFired: null, raw: {} };
      }
    } else {
      exif = { shutter: null, iso: null, aperture: null, flashFired: null, raw: {} };
    }

    let url = dataUrl;
    if (!url && buffer) {
      url = await bufferToDataUrl(buffer, mime);
    }

    const bitmap = await decodeImage(url);
    if (!bitmap) {
      // decode failed (e.g. HEIC renamed): honest notice, keep the page alive
      showCardNotice('That file could not be decoded by this browser. Try a JPEG, PNG or WebP.', true);
      return;
    }

    const w = bitmap.width || bitmap.naturalWidth || 0;
    const h = bitmap.height || bitmap.naturalHeight || 0;
    // R9b: close the previous bitmap before overwrite (ImageBitmap holds GPU memory).
    const prevBitmap = window.__sparklerLab && window.__sparklerLab.imageBitmap;
    if (prevBitmap && prevBitmap !== bitmap &&
        typeof prevBitmap.close === 'function' &&
        prevBitmap !== (window.__sparklerLab.source || null)) {
      try { prevBitmap.close(); } catch (e) { /* already detached */ }
    }
    window.__sparklerLab = {
      ...window.__sparklerLab,
      source: bitmap,          // analyze.js contract
      imageBitmap: bitmap,     // task-required key
      imageDataUrl: url,       // task-required key (editor/export reuse)
      exif,
      fileName: fileName || 'photo',
      mime: mime || 'image/jpeg',
      width: w,
      height: h
    };

    renderExifCard(exif, fileName);
    dispatchImageLoaded();
    if (fileName && /sample-/.test(String(fileName))) {
      // R3: "sample loaded" toast fires after the synchronous analyze pass, so the
      // score is real; falls back to a plain ack if analysis is unavailable.
      const a = (typeof window !== 'undefined' && window.__sparklerLab &&
        window.__sparklerLab.analysis) || null;
      showToast(a && Number.isFinite(a.total)
        ? 'Sample loaded \u2014 score ' + a.total
        : 'Sample loaded');
      scrollToEditorToolbar();
      updateLabThumb();
    }
  } catch (e) {
    console.error('[app] pipeline failed:', e);
    try { showCardNotice('Something went wrong loading that photo. Try another file.', true); } catch (_) {}
  }
}

/* R3b: land the editor toolbar + canvas both in view after a sample load. */
function scrollToEditorToolbar() {
  try {
    const toolbar = document.querySelector('#s4editor .editor-toolbar');
    const section = document.getElementById('s4editor');
    if (!toolbar || !section) return;
    if (typeof toolbar.scrollIntoView === 'function') {
      toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (e) { console.warn('[app] editor scroll failed:', e); }
}

/* R3c: small preview thumb of the loaded image inside the lab results. */
function updateLabThumb() {
  try {
    const wrap = document.querySelector('#s2lab .lab-results');
    if (!wrap) return;
    const url = window.__sparklerLab && window.__sparklerLab.imageDataUrl;
    if (!url) return;
    let fig = document.getElementById('labThumb');
    if (!fig) {
      fig = document.createElement('figure');
      fig.id = 'labThumb';
      fig.className = 'lab-thumb';
      const img = document.createElement('img');
      img.alt = 'Loaded photo preview';
      const cap = document.createElement('figcaption');
      cap.textContent = 'Loaded photo';
      fig.appendChild(img);
      fig.appendChild(cap);
      wrap.insertBefore(fig, wrap.firstChild);
    }
    const img = fig.querySelector('img');
    if (img) img.src = url;
  } catch (e) { console.warn('[app] lab thumb failed:', e); }
}

function bufferToDataUrl(buffer, mime) {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([buffer], { type: mime || 'image/jpeg' });
      if (typeof FileReader === 'function') {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error || new Error('dataURL read failed'));
        fr.readAsDataURL(blob);
      } else {
        blobToDataUrlViaCanvas(blob).then(resolve, reject);
      }
    } catch (e) { reject(e); }
  });
}

/* Node/dev fallback when FileReader is absent: binary -> base64 (no fetch). */
function blobToDataUrlViaCanvas(blob) {
  return blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    const b64 = (typeof btoa === 'function')
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
    return 'data:' + (blob.type || 'image/jpeg') + ';base64,' + b64;
  });
}

async function decodeImage(url) {
  try {
    // Preferred: createImageBitmap. It needs a Blob, so hand it the raw source
    // (Blob input skips fetch; dataURL input falls back to fetch -> blob).
    let bitmap = null;
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(urlToBlobSource(url));
      } catch (e) { /* fall through to Image() */ }
    }
    if (bitmap) return bitmap;
    if (typeof Image === 'function') return await imageElementDecode(url);
    console.error('[app] no image decoder available in this environment');
    return null;
  } catch (e) {
    console.error('[app] image decode failed:', e);
    return null;
  }
}

/* createImageBitmap accepts Blob | ImageData | ImageBitmap | OffscreenCanvas.
   Our pipeline hands us a dataURL string, so build a Blob from it (no fetch:
   data URLs decode locally). File/Blob inputs pass straight through. */
function urlToBlobSource(url) {
  if (Blob && (url instanceof Blob)) return url;
  if (typeof url === 'string' && url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const meta = url.slice(0, comma);
    const b64 = url.slice(comma + 1);
    const mime = (meta.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bin = atob ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return url; // object URLs (blob:) pass straight to createImageBitmap
}

function imageElementDecode(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = url;
  });
}

function dispatchImageLoaded() {
  try {
    // editor.js is event-driven but must be imported once; safe to re-import (module cache)
    import('./editor.js').catch((e) => console.error('[app] editor module unavailable:', e));
    const ev = new CustomEvent('sparklerlab:image-loaded');
    document.dispatchEvent(ev);
    if (typeof window !== 'undefined') window.dispatchEvent(ev); // analyze.js listens on both
  } catch (e) {
    console.error('[app] event dispatch failed:', e);
  }
}

/* ============================ camera ============================ */

function wireCamera() {
  const btn = document.getElementById('cameraBtn');
  if (btn) btn.addEventListener('click', openCamera);
}


function cameraSupported() {
  return typeof navigator !== 'undefined' && navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';
}

function cameraFallback() {
  try {
    showCardNotice(CAMERA_FALLBACK_TEXT, true);
    showToast(CAMERA_FALLBACK_TEXT);
    // R6: toast + card notice ONLY - no forced file-picker auto-open.
  } catch (e) {
    console.error('[app] camera fallback failed:', e);
  }
}

function closeCamera() {
  try {
    if (lab.stream) {
      for (const track of lab.stream.getTracks()) track.stop();
      lab.stream = null;
    }
    if (lab.keyHandler) {
      document.removeEventListener('keydown', lab.keyHandler);
      lab.keyHandler = null;
    }
    if (lab.overlay && lab.overlay.parentNode) lab.overlay.parentNode.removeChild(lab.overlay);
    lab.overlay = null;
  } catch (e) {
    console.error('[app] camera teardown failed:', e);
  }
}

async function openCamera() {
  try {
    if (!cameraSupported()) { cameraFallback(); return; }
    if (lab.overlay) return; // already open

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    lab.stream = stream;

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Camera capture');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:rgba(5,7,10,0.92);' +
      'display:flex;align-items:center;justify-content:center;padding:1rem;';
    const panel = document.createElement('div');
    panel.style.cssText =
      'background:var(--panel, #141824);border:1px solid var(--border, #232936);' +
      'border-radius:10px;padding:1rem;max-width:min(92vw, 720px);text-align:center;';
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;
    video.style.cssText = 'display:block;max-width:100%;max-height:70vh;border-radius:10px;';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:0.75rem;justify-content:center;margin-top:0.75rem;';
    const captureBtn = document.createElement('button');
    captureBtn.type = 'button';
    captureBtn.textContent = 'Capture';
    captureBtn.style.cssText = btnStyle('var(--accent, #ffb347)');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel (Esc)';
    cancelBtn.style.cssText = btnStyle('var(--muted, #9aa0ae)');
    row.appendChild(captureBtn);
    row.appendChild(cancelBtn);
    panel.appendChild(video);
    panel.appendChild(row);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    lab.overlay = overlay;

    const onEsc = (e) => { if (e.key === 'Escape') closeCamera(); };
    document.addEventListener('keydown', onEsc);
    lab.keyHandler = onEsc;
    cancelBtn.addEventListener('click', closeCamera);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCamera(); });

    const startErr = (e) => { console.error('[app] camera stream failed:', e); closeCamera(); cameraFallback(); };
    if (video.play) video.play().catch(startErr);

    captureBtn.addEventListener('click', () => {
      try {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) { console.error('[app] camera frame not ready'); return; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        closeCamera();
        loadIntoPipeline({ buffer: null, dataUrl, fileName: 'camera-capture.jpg', mime: 'image/jpeg' });
      } catch (e) {
        console.error('[app] capture failed:', e);
        closeCamera();
        cameraFallback();
      }
    });
  } catch (e) {
    const name = e && e.name;
    console.error('[app] getUserMedia failed:', name || '', e);
    closeCamera();
    // NotAllowedError / NotFoundError / NotReadableError / insecure context all fall back
    cameraFallback();
  }
}

function btnStyle(color) {
  return 'min-height:44px;padding:0.55rem 1.25rem;border-radius:10px;border:1px solid ' + color +
    ';background:transparent;color:' + color + ';font:inherit;cursor:pointer;';
}

/* ============================ samples ============================ */

/** Delegated: any [data-sample] button pulls its sample into the pipeline. */
function wireSamples() {
  document.addEventListener('click', (e) => {
    try {
      const trigger = e.target && e.target.closest && e.target.closest('[data-sample]');
      if (!trigger) return;
      e.preventDefault();
      const name = trigger.getAttribute('data-sample');
      const file = (name && /\.(jpe?g|png|webp)$/i.test(name)) ? name
        : (name ? ('sample-' + name + '.jpg') : DEFAULT_SAMPLE);
      loadSample(SAMPLE_DIR + file, file);
    } catch (err) {
      console.error('[app] sample load failed:', err);
    }
  });
}

function loadSample(url, fileName) {
  showToast('Loading sample\u2026');
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.arrayBuffer();
    })
    .then((buffer) => loadIntoPipeline({ buffer, dataUrl: null, fileName, mime: 'image/jpeg' }))
    .catch((e) => console.error('[app] sample fetch failed:', e));
}

/* ============================ editor handoff ============================ */

function wireSendToEditor() {
  const btn = document.getElementById('sendToEditor');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      if (!(window.__sparklerLab && window.__sparklerLab.imageDataUrl)) {
        showToast('Load a photo first');
        showCardNotice('Load a photo first, then send it to the editor.', false);
        return;
      }
      document.dispatchEvent(new CustomEvent('sparklerlab:send-to-editor'));
      const target = document.getElementById('s4editor');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      // defensive: editor module may not be loaded yet
      import('./editor.js').catch(() => {});
    } catch (e) {
      console.error('[app] editor handoff failed:', e);
    }
  });
}
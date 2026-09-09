/*! toast.js — Sparkler Exit Lab shared toast (P4 R3)
 *  One singleton, bottom-center, gold border, auto-fades after 2.2s.
 *  Used for: sample loading/loaded, load-a-photo-first guard, camera fallback,
 *  head-card selection. Exports showToast(message).
 */

const TOAST_MS = 2200;

let el = null;
let hideTimer = 0;

function ensureToast() {
  if (el && el.isConnected) return el;
  el = document.getElementById('labToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'labToast';
    document.body.appendChild(el);
  }
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  return el;
}

export function showToast(message) {
  if (typeof document === 'undefined' || !document.body) return;
  try {
    const t = ensureToast();
    t.textContent = String(message || '');
    t.classList.add('is-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => t.classList.remove('is-visible'), TOAST_MS);
  } catch (e) {
    console.warn('[toast] showToast failed:', e);
  }
}

/* Eagerly mount the singleton so the element exists for QA hooks and
 * screen readers before the first toast fires. Module scripts run after
 * <body> is parsed (deferred), so this is safe. */
if (typeof document !== 'undefined' && document.body) {
  try { ensureToast(); } catch (e) { /* showToast retries lazily */ }
} else if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    try { ensureToast(); } catch (e) { /* showToast retries lazily */ }
  }, { once: true });
}
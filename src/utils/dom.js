/**
 * @fileoverview Tiny DOM helpers so views don't sprinkle boilerplate everywhere.
 *
 * Public import target for callers (see CONTRIBUTING.md and the ESLint
 * DOM-sink tripwire, which both cite `src/utils/dom.js`).
 *
 * This is a *thin facade* over src/utils/dom/*. Splitting the file into focused
 * submodules keeps each concern isolated without forcing every importer to
 * rewrite its import path: escapeHtml, showToast, the layer stack, and the
 * focus trap are all re-exported from here.
 *
 * Layout:
 *   dom/layerStack.js — the modal layer stack (pushLayer / popLayer / …). The
 *     only stateful module; `layers` and `layerRegistry` live here alone.
 *   dom/focus.js      — the focus trap (focusableWithin / trapFocus).
 *   dom/escape.js     — escapeHtml / safeUrl.
 *   dom/bind.js       — on.
 *   dom/toast.js      — showToast.
 *
 * Escape anything that came from imported data before it becomes markup: pass
 * it through escapeHtml() or write with textContent instead of innerHTML; never
 * sanitize on import (that corrupts data and breaks export round-trips).
 */

// Modal layer stack (stateful) — re-exported from src/utils/dom/layerStack.js.
// The facade re-exports the functions, never the `layers` array, so there is a
// single shared stack.
export {
  MODAL_Z_BASE,
  registerModalLayer,
  stackDepth,
  topLayerId,
  topLayer,
  pushLayer,
  popLayer,
  closeLayer,
  closeTopLayer,
  resetLayers,
} from './dom/layerStack.js';

// Focus trap — re-exported from src/utils/dom/focus.js.
export { focusableWithin, trapFocus } from './dom/focus.js';

// The escape / bind / toast helpers stay inline in this facade until the next
// commit extracts them to dom/escape.js, dom/bind.js and dom/toast.js.

/**
 * Bind a DOM listener by element id, tolerating missing markup.
 *
 * Boot wiring calls this for every static control. A missing node must never
 * throw — an exception here would abort the whole registration phase (skipping
 * cache restore and the first render) — and must never disable the sibling
 * bindings, so every call is independent and total. The warning keeps a
 * renamed/relocated element id visible instead of silently disabling a feature.
 *
 * Existing markup is unaffected: the returned boolean lets callers assert the
 * binding happened (see the wiring-contract test).
 *
 * @param {string} id      Element id (as mounted by the component modules).
 * @param {string} type    Event type, e.g. 'click'.
 * @param {EventListener} handler
 * @returns {boolean} Whether the listener was bound.
 */
export function on(id, type, handler) {
  const el = document.getElementById(id);
  if (!el) {
    // Mirrors the existing console.warn practice (store.js migration,
    // download.js fallback, modal stack guard).
    console.warn(`[wiring] #${id} not found — "${type}" listener skipped`);
    return false;
  }
  el.addEventListener(type, handler);
  return true;
}

/**
 * Escape a string for safe insertion into `innerHTML` contexts.
 * Prefer `textContent` / `innerText` where possible.
 *
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Resolve a string into a safe absolute http(s) URL for use in `href`
 * attributes / properties.
 *
 * This is NOT HTML-escaping (use `escapeHtml` for that): it prevents the
 * `javascript:` / `data:` URL scheme attacks that survive attribute escaping
 * when a URL is assigned to an `href`. Returns the normalized `href` for valid
 * http(s) URLs, or `''` for anything else so the caller can fall back to a
 * safe placeholder (e.g. `'#'`).
 *
 * @param {string|null|undefined} url
 * @returns {string}  Safe http(s) URL string, or '' if unsafe/unparseable.
 */
export function safeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

/**
 * Show a toast notification for 2.5s.
 *
 * @param {string} message
 */
export function showToast(message) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMsg');
  if (!toast || !msgEl) return;
  msgEl.innerText = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2500);
}

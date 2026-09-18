/**
 * @fileoverview Tiny DOM helpers so views don't sprinkle boilerplate everywhere.
 *
 * Includes modal focus helpers (openModal / closeModal / trapFocus) that give
 * every overlay role="dialog" / aria-modal focus management: moving focus into
 * the modal on open, restoring it to the opener on close, and keeping Tab
 * focus inside the modal while it is open.
 */

/**
 * Selector for elements that can receive focus inside a modal overlay.
 * Disabled buttons/inputs are excluded so the trap skips them.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

/**
 * Show a modal overlay, moving focus into it and remembering the element that
 * had focus so closeModal can restore focus later.
 *
 * @param {HTMLElement} modal
 */
export function openModal(modal) {
  if (!modal) return;
  modal.previouslyFocused = document.activeElement || null;
  modal.classList.remove('hidden');
  if (typeof modal.focus === 'function') modal.focus();
}

/**
 * Hide a modal overlay and hand focus back to the element that opened it.
 *
 * @param {HTMLElement} modal
 */
export function closeModal(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
  const target = modal.previouslyFocused;
  modal.previouslyFocused = null;
  if (target && typeof target.focus === 'function') target.focus();
}

/**
 * Return the list of focusable elements inside a modal.
 *
 * @param {HTMLElement} modal
 * @returns {HTMLElement[]}
 */
export function focusableWithin(modal) {
  if (!modal || typeof modal.querySelectorAll !== 'function') return [];
  return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR));
}

/**
 * Keep Tab/Shift+Tab focus inside a modal: when the user tabs past the last
 * (or shift+tabs before the first) focusable element, fold focus back to the
 * other end. Designed to be called from a document-level Tab keydown handler.
 *
 * @param {HTMLElement} modal
 * @param {KeyboardEvent} event
 */
export function trapFocus(modal, event) {
  const items = focusableWithin(modal);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const idx = items.indexOf(document.activeElement);
  const atStart = idx <= 0;
  const atEnd = idx === -1 || idx === items.length - 1;
  if (event.shiftKey) {
    if (atStart) {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  } else if (atEnd) {
    event.preventDefault();
    items[0].focus();
  }
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
    .replace(/"/g, '&quot;');
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

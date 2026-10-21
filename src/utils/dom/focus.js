/**
 * @fileoverview Focus-trap helpers for modal overlays.
 *
 * Shared by src/views/modalListeners.js (which calls trapFocus from the
 * document-level Tab handler) and src/utils/dom/layerStack.js (via the public
 * facade). Stateless: no module-level mutable state, so it can be tested in
 * isolation without touching the layer stack.
 */

/**
 * Selector for elements that can receive focus inside a modal overlay.
 * Disabled buttons/inputs are excluded so the trap skips them.
 */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

/**
 * Should this element be reachable by Tab? Hidden overlays must stay out of the
 * trap, but querySelectorAll returns them anyway.
 *
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isVisible(el) {
  for (let node = el; node; node = node.parentElement) {
    if (node.classList && node.classList.contains('hidden')) return false;
  }
  return true;
}

/**
 * Return the list of focusable elements inside a modal, skipping hidden ones.
 *
 * @param {HTMLElement} modal
 * @returns {HTMLElement[]}
 */
export function focusableWithin(modal) {
  if (!modal || typeof modal.querySelectorAll !== 'function') return [];
  return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
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

/**
 * @fileoverview Boot-time DOM wiring.
 *
 * Binds a DOM listener by element id, tolerating missing markup: a missing
 * node must never throw (an exception here would abort the whole registration
 * phase, skipping cache restore and the first render) and must never disable
 * sibling bindings, so every call is independent and total. The warning keeps a
 * renamed/relocated element id visible instead of silently disabling a feature.
 *
 * Re-exported by the public facade src/utils/dom.js so importers and the
 * wiring-contract test keep working unchanged.
 */

/**
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

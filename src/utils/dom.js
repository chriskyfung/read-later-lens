/**
 * @fileoverview Tiny DOM helpers so views don't sprinkle boilerplate everywhere.
 *
 * Public import target for callers (see CONTRIBUTING.md and the ESLint
 * DOM-sink tripwire, which both cite `src/utils/dom.js`).
 *
 * This is a *thin facade* over src/utils/dom/*. Splitting the file into focused
 * submodules keeps each concern isolated without forcing every importer to
 * rewrite its import path: every public name — the modal layer stack, the focus
 * trap, the escape/bind/toast helpers — is re-exported from here.
 *
 * Layout:
 *   dom/layerStack.js — the modal layer stack (pushLayer / popLayer / …). The
 *     only stateful module; `layers` and `layerRegistry` live here alone.
 *   dom/focus.js      — the focus trap (focusableWithin / trapFocus).
 *   dom/escape.js     — escapeHtml / safeUrl (security helpers, no DOM dep).
 *   dom/bind.js       — on (boot-time listener wiring).
 *   dom/toast.js      — showToast (2.5s transient notification).
 *
 * Escape anything that came from imported data before it becomes markup: pass
 * it through escapeHtml() or write with textContent instead of innerHTML; never
 * sanitize on import (that corrupts data and breaks export round-trips).
 */

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

export { focusableWithin, trapFocus } from './dom/focus.js';

export { escapeHtml, safeUrl } from './dom/escape.js';

export { on } from './dom/bind.js';

export { showToast } from './dom/toast.js';

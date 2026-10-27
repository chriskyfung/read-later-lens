/**
 * @fileoverview DOM helpers barrel — stable public surface for the split.
 *
 * Importers reach through this barrel (src/utils/dom/index.js), not into the
 * individual modules, so the internal file layout can evolve without touching
 * callers. Mirrors src/views/sidebar/index.js and src/views/trash/index.js.
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
} from './layerStack.js';

export { focusableWithin, trapFocus } from './focus.js';

export { escapeHtml, safeUrl } from './escape.js';

export { on } from './bind.js';

export { showToast } from './toast.js';

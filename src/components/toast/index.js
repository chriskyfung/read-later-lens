/** @fileoverview Toast markup barrel — stable public surface for the split.

Mirrors src/components/header/index.js: importers reach through this facade,
not into the individual module, so the internal file layout can evolve without
touching callers.
 */

export { toastHtml } from './toast.js';

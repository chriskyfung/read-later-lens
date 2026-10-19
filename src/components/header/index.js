/**
 * @fileoverview Header markup barrel — stable public surface for the split.
 *
 * Importers reach through this facade (src/main.js, tests), not into the
 * individual modules, so the internal file layout can evolve without
 * touching callers. Mirrors src/components/bookmarks/trash/index.js.
 */

export { headerHtml, mountHeader } from './shell.js';
export { HEADER_IDS } from './constants.js';

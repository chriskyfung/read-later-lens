/**
 * @fileoverview Reader modal markup barrel — stable public surface for the split.
 *
 * Mirrors src/components/bookmarks/trash/index.js: importers reach through
 * this facade, not into the individual module, so the internal file layout
 * can evolve without touching callers.
 */
export { readerModalHtml } from './readerModal.js';

/**
 * @fileoverview Trash markup barrel — stable public surface for the split.
 *
 * Mirrors src/views/trash.js: importers reach through this facade, not into
 * the individual modules, so the internal file layout can evolve without
 * touching callers. tests/dom-xss-sinks.test.js imports trashItemHtml
 * directly from ./item.js to pin the sink to its source file.
 */
export { trashItemColumns, trashItemClass } from './constants.js';
export { formatDeletedAt } from './formatters.js';
export { trashItemHtml } from './item.js';
export { trashModalHtml } from './modal.js';

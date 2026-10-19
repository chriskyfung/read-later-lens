/**
 * @fileoverview Deprecated shim — the trash markup now lives in
 * src/components/bookmarks/trash/ (constants, formatters, item, modal +
 * index facade).
 *
 * Kept for one release so any importer still pointing at this path keeps
 * working; the facade is a pure re-export with no behaviour of its own.
 * Follow-up: drop this file once all callers import ./trash/index.js.
 *
 * @deprecated import from './trash/index.js' instead.
 */
export {
  trashItemColumns,
  trashItemClass,
  formatDeletedAt,
  trashItemHtml,
  trashModalHtml,
} from './trash/index.js';

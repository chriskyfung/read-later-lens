/**
 * @fileoverview Trash row constants — presentation tokens for one trashed row.
 *
 * Extracted verbatim from src/components/bookmarks/trashModal.js when the trash
 * markup split into src/components/bookmarks/trash/*. The class string is pinned
 * verbatim by tests/components-bookmarks-trashModal.test.js.
 */

/** Columns for each trashed row (documentation of the row structure). */
export const trashItemColumns = [
  { key: 'title', label: '標題' },
  { key: 'sourceFile', label: '來源' },
  { key: 'deletedAt', label: '刪除於' },
];

/**
 * Card shell for one trashed row — the monolith's panel-side class restored
 * verbatim, so each bookmark renders as a bordered card that isolates it from
 * its neighbours. The exact string is pinned by tests.
 */
export function trashItemClass() {
  return 'bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-xl p-4 flex items-center justify-between gap-3 transition';
}

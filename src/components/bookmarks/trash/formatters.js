/**
 * @fileoverview Trash display formatters — pure functions, zero imports.
 *
 * Extracted verbatim from src/components/bookmarks/trashModal.js when the trash
 * markup split into src/components/bookmarks/trash/*. Isolated so unit tests can
 * import the timestamp formatting without pulling in the markup builders or a DOM
 * environment.
 */

/**
 * Format a `deleted_at` ISO timestamp for display.
 *
 * Falls back to the raw value when it cannot be parsed, so a corrupted cache
 * never renders "Invalid Date".
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDeletedAt(iso) {
  if (!iso) return '未知時間';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString('zh-TW', { hour12: false });
}

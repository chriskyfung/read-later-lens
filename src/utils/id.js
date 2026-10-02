/**
 * @fileoverview Identifiers minted for newly imported source files.
 *
 * Ids carry a `file_` prefix for backwards compatibility with sessions
 * already persisted to IndexedDB and unified exports that restore by id.
 * Uniqueness comes from `crypto.randomUUID()` — a v4 UUID — rather than
 * the previous timestamp-plus-`Math.random()` suffix.
 *
 * @returns {string} A `file_`-prefixed unique source-file id.
 */
export function newFileId() {
  return `file_${globalThis.crypto.randomUUID()}`;
}

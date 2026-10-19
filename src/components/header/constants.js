/** @fileoverview Header element ids — single source of truth for the DOM contract.
 *
 * Extracted from src/components/header.js when the header markup split into
 * src/components/header/*. Keeping the ids here means the view layer and the
 * markup layer agree on the ids without either reaching into the other.
 */

/** Ids of every header element the view layer wires listeners onto. */
export const HEADER_IDS = {
  appHeader: 'appHeader',
  searchInput: 'searchInput',
  clearSearchBtn: 'clearSearchBtn',
  clearCacheBtn: 'clearCacheBtn',
  clearCacheIcon: 'clearCacheIcon',
  importBtn: 'importBtn',
  fileInput: 'fileInput',
  saveBackBtn: 'saveBackBtn',
};

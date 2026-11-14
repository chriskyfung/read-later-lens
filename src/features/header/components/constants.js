/**
 * @fileoverview Header element ids — single source of truth for the DOM contract.
 *
 * Keeping the ids here means the view layer and the markup layer agree on the ids
 * without either reaching into the other.
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
  // Search help tooltip
  searchHelpBtn: 'searchHelpBtn',
  searchHelpTooltip: 'searchHelpTooltip',
};

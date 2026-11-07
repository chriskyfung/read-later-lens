/**
 * @fileoverview Sidebar view constants — element ids, pseudo-folder ids and
 * the dataset attributes the generated rows carry.
 *
 * The ids are the single source of truth for the sidebar markup
 * (../components/) and the sidebar view reads.
 */

/**
 * Ids of the sidebar elements the view reads and the actions listen on.
 * Keys are the roles, values are the markup ids — the markup side lives in
 * ../components/sections/*.js.
 */
export const SIDEBAR_IDS = {
  folderList: 'folderList',
  allFolderBtn: 'allFolderBtn',
  totalSourceCount: 'totalSourceCount',
  allCountBadge: 'allCountBadge',
  trashFolderBtn: 'trashFolderBtn',
  trashCountBadge: 'trashCountBadge',
  tagFilterCloud: 'tagFilterCloud',
  languageFilters: 'languageFilters',
  storageUsageText: 'storageUsageText',
  storageProgressBar: 'storageProgressBar',
};

/** Pseudo-folder id for "all bookmarks" (not a source file). */
export const FOLDER_ALL = 'ALL';

/** Pseudo-folder id for the trash row. */
export const FOLDER_TRASH = 'TRASH';

/**
 * Attribute names carried by the generated sidebar rows.
 *
 * The markup side writes them as attributes (../components/
 * folderRow.js) and the listeners select on them. The DOM dataset key of an
 * attribute is its camelCase form (`data-select-folder` → `selectFolder`),
 * which is what the view side assigns.
 */
export const SIDEBAR_DATA_ATTRS = {
  selectFolder: 'data-select-folder',
  deleteFolder: 'data-delete-folder',
  filterTag: 'data-filter-tag',
};

/** Class of the generated source-file rows (removed on every render). */
export const DYNAMIC_FILE_BTN_CLASS = 'dynamic-file-btn';

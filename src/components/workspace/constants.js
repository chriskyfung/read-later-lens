/**
 * @fileoverview DOM ids of the workspace shell.
 *
 * Single source of truth for the ids the workspace markup renders and the
 * workspace listeners look up. The markup lives in src/components/workspace/*
 * and the listeners in src/views/workspace/listeners.js, so a shared table
 * keeps a rename from silently breaking the wiring.
 *
 * Ids owned by the individual panels (bookmarks, linkage) stay with their
 * panel module; only the shell and control bar are listed here.
 */
export const WORKSPACE_IDS = {
  /** The wrapper the workspace is mounted into. */
  APP_BODY: 'appBody',
  /** The scrolling viewport that holds the tab panels. */
  CONTENT_VIEWPORT: 'contentViewport',
  /** The sort dropdown in the control bar. */
  SORT_SELECT: 'sortSelect',
  /** The counter next to the 書籤列表 tab label. */
  FILTERED_COUNT: 'filteredCount',
  /** The batch action bar (hidden until something is selected). */
  BATCH_ACTION_BAR: 'batchActionBar',
  /** The "已選擇 N 項" counter in the batch action bar. */
  SELECTED_COUNT: 'selectedCount',
  /** The batch-delete button. */
  BATCH_DELETE_BTN: 'batchDeleteBtn',
  /** The batch-cancel button. */
  BATCH_CANCEL_BTN: 'batchCancelBtn',
};

/**
 * @fileoverview Bookmarks feature barrel — presentation + behavior container.
 *
 * External importers reach through this facade,
 * never into components/ or behavior/ internals.
 */

// --- Presentation (markup only) ---
export { bookmarkCardClass, bookmarkCardHtml, panelBookmarksHtml } from './components';

// --- Behavior (state / events / side-effects) ---
export {
  renderBookmarkCards,
  updateBookmarksHeader,
  resolveFolderName,
  createBookmarkCard,
  toggleSelectBookmark,
  updateBatchActionBar,
  getBookmarkDomain,
} from './behavior';

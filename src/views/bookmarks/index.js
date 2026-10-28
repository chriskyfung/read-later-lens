/**
 * @fileoverview Facade for the bookmarks view modules.
 *
 * Re-exports the public surface of src/views/bookmarks/* so existing import
 * paths (src/views/bookmarks) keep working.
 */
export { renderBookmarkCards } from './render.js';
export { updateBookmarksHeader, resolveFolderName } from './header.js';
export { createBookmarkCard } from './card.js';
export { toggleSelectBookmark, updateBatchActionBar } from './selection.js';
export { getBookmarkDomain } from '../../utils/url.js';

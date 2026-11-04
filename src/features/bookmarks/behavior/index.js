/**
 * @fileoverview Facade for the bookmarks view modules.
 */
export { renderBookmarkCards } from './render.js';
export { updateBookmarksHeader, resolveFolderName } from './header.js';
export { createBookmarkCard } from './card.js';
export { toggleSelectBookmark, updateBatchActionBar } from './selection.js';
export { getBookmarkDomain } from '@/utils/url.js';

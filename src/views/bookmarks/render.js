/**
 * @fileoverview Render the bookmark cards grid (and its header side-effects).
 *
 * Always leaves the trash panel hidden: the grid is the non-trash view, and
 * src/views/trash/ is a dedicated modal; the grid stays mounted behind it.
 */
import { getFilteredBookmarks } from '../../core/filters.js';
import { updateBookmarksHeader } from './header.js';
import { createBookmarkCard } from './card.js';

/**
 * Render the bookmark cards grid (and its header side-effects).
 */
export function renderBookmarkCards() {
  const grid = document.getElementById('bookmarkCardsGrid');
  const emptyState = document.getElementById('emptyState');
  const filtered = getFilteredBookmarks();

  updateBookmarksHeader(filtered);

  grid.classList.remove('hidden');

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  grid.innerHTML = '';

  filtered.forEach((b) => grid.appendChild(createBookmarkCard(b)));
}

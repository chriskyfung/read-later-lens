/**
 * @fileoverview Render the bookmark cards grid (and its header side-effects).
 *
 * Always leaves the trash panel hidden: the grid is the non-trash view, and
 * src/features/trash/behavior/ is a dedicated modal; the grid stays mounted behind it.
 */
import { getFilteredBookmarks } from '@/core/filters.js';
import { updateBookmarksHeader } from './header.js';
import { createBookmarkCard } from './card.js';
import { initializeLucideIcons } from '@/utils/lucide.js';
import { GraphStar, Orbit, ExternalLink, SquareBookmark, Trash, Heart, FileText } from 'lucide';

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

  // Cards are re-rendered on every search/filter/import cycle. Re-initialize
  // Lucide so newly-inserted [data-lucide="graph-star"], [data-lucide="orbit"],
  // [data-lucide="external-link"], [data-lucide="square-bookmark"], and
  // [data-lucide="trash"] elements render instead of staying inert <i> placeholders.
  initializeLucideIcons({ GraphStar, Orbit, ExternalLink, SquareBookmark, Trash, Heart, FileText });
}

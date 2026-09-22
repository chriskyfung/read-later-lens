/**
 * @fileoverview Bookmark cards view — the main grid of bookmark cards.
 *
 * Card markup now lives in the presentational component src/components/bookmarks/card.js
 * (bookmarkCardClass / bookmarkCardHtml). This module owns the DOM orchestration:
 * the header side-effects (#filteredCount / #selectAllCheckbox / #activeFilterSummary /
 * #emptyState), card element creation + listener wiring, and selection that
 * mutates the live Set without re-rendering the grid. Delete & batch handlers
 * remain in src/views/workspaceActions.js for now.
 */

import { selectedIds, activeFolder, activeLang, sourceFiles } from '../core/state.js';
import { getFilteredBookmarks } from '../core/filters.js';
import { bookmarkCardClass, bookmarkCardHtml } from '../components/bookmarks/card.js';
import { openReaderModal } from './readerModal.js';
import { openSimilarityModal } from './similarityModal.js';

/**
 * Derive the domain badge text for a bookmark URL.
 *
 * Invalid URLs fall back to 'web' (matches the original monolith).
 *
 * @param {string} url
 * @returns {string}
 */
export function getBookmarkDomain(url) {
  let domain = 'web';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch {
    // Invalid URL — keep the 'web' fallback.
  }
  return domain;
}

/**
 * Resolve the human-readable folder / source-file name (monolith parity):
 * 'ALL' → 全部檔案, 'TRASH' → 回收桶, known folder → file.name, unknown → 未知.
 *
 * @returns {string}
 */
export function resolveFolderName() {
  let folderName = '全部檔案';
  if (activeFolder === 'TRASH') {
    folderName = '回收桶';
  } else if (activeFolder !== 'ALL') {
    const f = sourceFiles.get(activeFolder);
    folderName = f ? f.name : '未知';
  }
  return folderName;
}

/**
 * Update the grid header side-effects (#filteredCount, #selectAllCheckbox,
 * #activeFilterSummary). Reads activeLang / folder / selection state.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} filtered
 */
export function updateBookmarksHeader(filtered) {
  document.getElementById('filteredCount').innerText = filtered.length;
  document.getElementById('selectAllCheckbox').checked =
    filtered.length > 0 && filtered.every((b) => selectedIds.has(b.id));
  document.getElementById('activeFilterSummary').innerText =
    `目前分類: ${resolveFolderName()} | 語系: ${activeLang} | 符合: ${filtered.length} 筆`;
}

// Descendants that own their own click behaviour; clicking them must NOT
// trigger the card's "open reader" handler. Delete is delegated at the grid
// level (see src/views/workspaceActions.js), so it bails here as well.
const CARD_INTERACTIVE = 'a, button, input, label, [data-delete-bookmark]';

/**
 * Build a single bookmark card element and wire its per-card listeners.
 *
 * Does NOT append the card to the grid — the caller decides placement (the
 * original monolith appends inside the render loop). Clicking the card body
 * (not an inner control) opens the reader modal; the inline 📖 閱讀 button was
 * removed because the modal only surfaces the truncated preview. The card is
 * keyboard-activatable via Enter/Space.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} bookmark
 * @returns {HTMLDivElement}
 */
export function createBookmarkCard(bookmark) {
  const card = document.createElement('div');
  const isSelected = selectedIds.has(bookmark.id);
  const domain = getBookmarkDomain(bookmark.url);

  card.className = bookmarkCardClass(isSelected);
  card.innerHTML = bookmarkCardHtml({ bookmark, domain, isSelected });

  card
    .querySelector('.select-bookmark-cb')
    .addEventListener('change', () => toggleSelectBookmark(bookmark.id));
  card
    .querySelector('.open-similarity-btn')
    .addEventListener('click', () => openSimilarityModal(bookmark.id));
  card.querySelector('[data-delete-bookmark]').dataset.deleteBookmark = bookmark.id;

  card.tabIndex = 0;
  card.addEventListener('click', (e) => {
    if (e.target.closest(CARD_INTERACTIVE)) return;
    openReaderModal(bookmark.id);
  });
  card.addEventListener('keydown', (e) => {
    if (e.target !== card) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openReaderModal(bookmark.id);
    }
  });
  return card;
}

/**
 * Render the bookmark cards grid (and its header side-effects).
 *
 * Always leaves the trash panel hidden: the grid is the non-trash view, and
 * src/views/trash.js shows the panel when activeFolder === 'TRASH'.
 */
export function renderBookmarkCards() {
  const grid = document.getElementById('bookmarkCardsGrid');
  const emptyState = document.getElementById('emptyState');
  const filtered = getFilteredBookmarks();

  updateBookmarksHeader(filtered);

  document.getElementById('trashPanel')?.classList.add('hidden');
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

/**
 * Toggle bookmark selection (mutates the live Set; no card re-render —
 * matches the original monolith).
 *
 * @param {string} id
 */
export function toggleSelectBookmark(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  updateBatchActionBar();
}

/**
 * Update the batch action bar visibility + selected count (monolith parity).
 */
export function updateBatchActionBar() {
  const bar = document.getElementById('batchActionBar');
  const count = document.getElementById('selectedCount');
  if (selectedIds.size > 0) {
    count.innerText = selectedIds.size;
    bar.classList.remove('hidden');
    bar.classList.add('flex');
  } else {
    bar.classList.add('hidden');
    bar.classList.remove('flex');
  }
}

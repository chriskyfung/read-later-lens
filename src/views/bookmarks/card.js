/**
 * @fileoverview Bookmark card element factory — DOM creation + per-card listener wiring.
 *
 * Markup comes from src/components/bookmarks/card.js (bookmarkCardClass /
 * bookmarkCardHtml); this module owns element creation and wiring only.
 */
import { selectedIds } from '../../core/state';
import { bookmarkCardClass, bookmarkCardHtml } from '../../components/bookmarks';
import { getBookmarkDomain } from '../../utils/url.js';
import { openReaderModal } from '../reader';

import { openSimilarityModal } from '../similarityModal.js';
import { openLinkageForBookmark } from '../linkage';
import { toggleSelectBookmark } from './selection.js';

// Descendants that own their own click behaviour; clicking them must NOT
// trigger the card's "open reader" handler. Delete is delegated at the grid
// level (see src/views/workspace/actions.js), so it bails here as well.
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
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord} bookmark
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
  card
    .querySelector('.open-linkage-btn')
    .addEventListener('click', () => openLinkageForBookmark(bookmark.id));
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

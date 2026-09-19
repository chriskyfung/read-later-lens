/**
 * @fileoverview Filtering & sorting logic — pure functions, no DOM.
 *
 * Every view calls `getFilteredBookmarks()` as the single entry point so
 * filtering and sorting stay in one place and can be unit-tested in isolation.
 * Semantics match the original monolith exactly.
 */

import { bookmarks, activeFolder, activeLang, activeTag, searchQuery, sortBy } from './state.js';
import { parseSearchQuery } from './searchParser.js';

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} list
 * @returns {import('../model/BookmarkRecord.js').BookmarkRecord[]}
 */
export function applyFilters(list) {
  let filtered = [...list]; // shallow copy - mirrors monolith's [...state.bookmarks]

  // Folder / source-file filter
  if (activeFolder !== 'ALL') {
    filtered = filtered.filter((b) => b.source_file_id === activeFolder);
  }

  // Language filter
  if (activeLang !== 'ALL') {
    if (activeLang === 'other') {
      filtered = filtered.filter((b) => !['en', 'zh', 'ja'].includes(b.detected_language));
    } else {
      filtered = filtered.filter((b) => b.detected_language === activeLang);
    }
  }

  // Tag filter
  if (activeTag) {
    filtered = filtered.filter((b) => b.tags && b.tags.includes(activeTag));
  }

  // Keyword search (with relevance scoring).
  // Multi-term support: bare terms are AND-ed keywords; quoted phrases are
  // exact matches. Order-independent ('term1 term2' ≡ 'term2 term1').
  const parsed = parseSearchQuery(searchQuery);
  if (parsed.length > 0) {
    filtered = filtered
      .map((b) => {
        const titleLower = (b.title || '').toLowerCase();
        const previewLower = (b.article_preview || '').toLowerCase();
        const urlLower = (b.url || '').toLowerCase();
        const tagsLower = (b.tags || []).map((t) => t.toLowerCase());
        let totalScore = 0;

        for (const term of parsed) {
          // Every term must match in at least one field (AND semantics);
          // quoted phrases match as contiguous substrings within each field.
          let score = 0;
          if (term.urlOnly) {
            // 'link:' field operator — only the URL is examined.
            if (urlLower.includes(term.terms)) score += 3;
          } else {
            if (titleLower.includes(term.terms)) score += 10;
            if (previewLower.includes(term.terms)) score += 5;
            if (urlLower.includes(term.terms)) score += 3;
            if (tagsLower.some((t) => t.includes(term.terms))) score += 8;
          }
          if (score === 0) return { bookmark: b, score: 0 };
          totalScore += score;
        }
        return { bookmark: b, score: totalScore };
      })
      .filter((item) => item.score > 0);

    if (sortBy === 'relevance') {
      filtered.sort((a, b) => b.score - a.score);
    }
    filtered = filtered.map((item) => item.bookmark);
  }

  // Standard sort (when relevance is not active)
  if (sortBy === 'newer') {
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
  } else if (sortBy === 'older') {
    filtered.sort((a, b) => Number(a.id) - Number(b.id));
  } else if (sortBy === 'title_asc') {
    filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-TW'));
  } else if (sortBy === 'title_desc') {
    filtered.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'zh-TW'));
  }

  return filtered;
}

/**
 * @returns {import('../model/BookmarkRecord.js').BookmarkRecord[]}
 */
export function getFilteredBookmarks() {
  return applyFilters(bookmarks);
}

/**
 * Top-N items for a given filter. Useful for charts that cap their render.
 *
 * @param {number} n
 * @returns {import('../model/BookmarkRecord.js').BookmarkRecord[]}
 */
export function getFilteredBookmarksTop(n) {
  return applyFilters(bookmarks).slice(0, n);
}

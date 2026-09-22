/**
 * @fileoverview Alias-tolerant field mapping: raw provider records -> unified
 * BookmarkRecord fields.
 *
 * Each provider may label the same concept differently (e.g. `title` vs `name`,
 * `url` vs `link` vs `original_url`). This module centralizes the alias
 * resolution so the instapaper adapter stays thin and behaviour matches the
 * original monolith exactly - including its `||` short-circuit semantics.
 */

import { EMPTY_TITLE, UNKNOWN_URL } from './BookmarkRecord.js';

/**
 * Map a raw provider record to normalized fields, keeping the exact resolution
 * order and fallbacks of the original monolith:
 *
 *   id      = rec.id || rec.bookmark_id || rec.uid || fallbackId || (Date.now() + index)
 *   title   = rec.title || rec.name || EMPTY_TITLE
 *   url     = rec.url || rec.link || rec.original_url || UNKNOWN_URL
 *   preview = rec.article_preview || rec.description || rec.preview
 *             || rec.excerpt || rec.summary || ''
 *   content = rec.content || preview
 *
 * The monolith used `||` (truthiness), so empty strings / 0 / false fall
 * through to the next candidate rather than being kept as-is.
 *
 * @param {object} rec         Raw record from a provider export.
 * @param {number} index       Record index within the batch (for synthetic IDs).
 * @param {string} [fallbackId] Overrides the `Date.now() + index` fallback.
 * @returns {{ id: string, title: string, url: string, preview: string, content: string }}
 */
export function normalizeFields(rec, index, fallbackId) {
  const id =
    rec.id || rec.bookmark_id || rec.uid || (fallbackId != null ? fallbackId : Date.now() + index);

  const preview =
    rec.article_preview || rec.description || rec.preview || rec.excerpt || rec.summary || '';

  return {
    id: String(id),
    title: rec.title || rec.name || EMPTY_TITLE,
    url: rec.url || rec.link || rec.original_url || UNKNOWN_URL,
    preview,
    content: rec.content || preview,
  };
}

/**
 * Normalize a tag field into a string[], matching the original monolith:
 *
 *   tags = rec.tags
 *            ? (Array.isArray(rec.tags) ? rec.tags : String(rec.tags).split(','))
 *            : []
 *
 * - Falsy input (undefined/null/''/0/false/NaN) -> [].
 * - Arrays are returned untouched (no trimming, filtering, or copying).
 * - Anything else is split strictly on commas (whitespace is preserved).
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw).split(',');
}

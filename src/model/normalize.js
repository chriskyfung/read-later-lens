/**
 * @fileoverview Alias-tolerant field mapping: raw provider records -> unified
 * BookmarkRecord fields.
 *
 * Each provider may label the same concept differently (e.g. `title` vs `name`,
 * `url` vs `link` vs `original_url`, or capitalized CSV headers like `Title`).
 * This module centralizes the alias resolution so the instapaper adapter stays
 * thin. Resolution runs against a lowercased-key view of the record — exact
 * lowercase keys behave exactly like the original `||` chain, while
 * case-variants (`URL`, `Title`) resolve instead of silently falling through
 * to the defaults. Field resolution keeps the monolith's truthiness semantics:
 * empty strings / 0 / false fall through to the next candidate.
 */

import { EMPTY_TITLE, UNKNOWN_URL } from './BookmarkRecord.js';

/**
 * Build a lowercased-key view of a raw record so `Title`/`URL`/`LINK`
 * headers resolve through the same aliases as their lowercase spellings.
 * When both spellings exist, the last key wins (pathological input).
 *
 * @param {object} rec
 * @returns {Record<string, unknown>}
 */
function lowerKeyed(rec) {
  const lower = {};
  for (const key of Object.keys(rec)) lower[key.toLowerCase()] = rec[key];
  return lower;
}

/**
 * Deterministic FNV-1a 64-bit hash of a URL, formatted as 16 hex chars.
 * Sync, dependency-free, and collision-safe at personal-library scale — the
 * same URL always yields the same `gen_…` id across sessions and re-imports,
 * so re-importing an id-less file merges instead of duplicating every row.
 *
 * @param {string} url
 * @returns {string} e.g. `gen_a1b2c3d4e5f60718`
 */
export function stableIdFromUrl(url) {
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK64 = 0xffffffffffffffffn;
  let hash = FNV_OFFSET;
  const text = String(url);
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return 'gen_' + hash.toString(16).padStart(16, '0');
}

/**
 * Map a raw record to normalized fields. Resolution order (case-insensitive):
 *
 *   id      = id || bookmark_id || uid || fallbackId
 *             || stableIdFromUrl(url) || (Date.now() + index)
 *   title   = title || name || EMPTY_TITLE
 *   url     = url || link || original_url || UNKNOWN_URL
 *   preview = article_preview || description || preview || excerpt
 *             || summary || ''
 *   content = content || preview
 *
 * `Date.now()+index` only survives when a record has neither an id nor a URL
 * — such rows are dropped by the adapters (no usable URL = no bookmark).
 *
 * @param {object} rec         Raw record from a provider export.
 * @param {number} index       Record index within the batch (for last-resort ids).
 * @param {string} [fallbackId] Explicit id override — beats the stable hash.
 * @returns {{ id: string, title: string, url: string, preview: string, content: string }}
 */
export function normalizeFields(rec, index, fallbackId) {
  const lower = lowerKeyed(rec);

  const url = lower.url || lower.link || lower.original_url || UNKNOWN_URL;
  const preview =
    lower.article_preview ||
    lower.description ||
    lower.preview ||
    lower.excerpt ||
    lower.summary ||
    '';

  let id;
  if (lower.id || lower.bookmark_id || lower.uid) {
    id = lower.id || lower.bookmark_id || lower.uid;
  } else if (fallbackId != null) {
    id = fallbackId;
  } else if (url !== UNKNOWN_URL) {
    id = stableIdFromUrl(url);
  } else {
    id = Date.now() + index;
  }

  return {
    id: String(id),
    title: lower.title || lower.name || EMPTY_TITLE,
    url,
    preview,
    content: lower.content || preview,
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

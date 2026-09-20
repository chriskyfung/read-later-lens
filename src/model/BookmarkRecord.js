/**
 * @fileoverview Normalized bookmark record — provider-agnostic data model.
 *
 * Every provider adapter (Instapaper, Raindrop, …) must map its export
 * fields onto this schema so the rest of the app never knows where a
 * bookmark came from.
 */

/**
 * @typedef {object} BookmarkRecord
 * @property {string} id                Unique bookmark identifier (stringified).
 * @property {string} title            Display title; never empty.
 * @property {string} url              Original URL; '#' if unknown.
 * @property {string} article_preview Plain-text preview / excerpt.
 * @property {string} content         Full text content (falls back to preview).
 * @property {string} source_file_id  Which imported source file owns this.
 * @property {string} source_file_name Human-readable source file name.
 * @property {string} detected_language ISO-like tag: 'en' | 'zh' | 'ja' | 'other'.
 * @property {string[]} tags          List of tag strings.
 * @property {string} instapaper_url Reader deep-link URL (written by the adapter).
 * @property {string} [provider]      Provider slug, e.g. 'instapaper'.
 * @property {string|null} [deleted_at] ISO timestamp once soft-deleted; null /
 *   absent while active. The trash view is simply a projection over this field,
 *   so no separate store or IndexedDB migration is needed.
 */

/** @type {import('./BookmarkRecord.js').BookmarkRecord} */
export const EMPTY_TITLE = 'Untitled Article';
export const UNKNOWN_URL = '#';
export const DEFAULT_LANG = 'en';

/**
 * @param {string} provider
 * @param {string} rawId
 * @returns {string} Provider-specific reader URL (may be empty string).
 */
export function makeReaderUrl(provider, rawId) {
  if (provider === 'instapaper') {
    return `https://www.instapaper.com/read/${rawId}`;
  }
  // Raindrop, Pocket, … extend this switch.
  return '';
}

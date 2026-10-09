/**
 * @fileoverview URL helpers — shared hostname extraction for display domains.
 *
 * Extraction policy (leading `www.` strip) is applied in one place:
 * * `src/analytics/domains.js` — top-domains, skip-on-invalid
 * * `src/analytics/linkage.js` — graph node domains, 'unknown' fallback
 * * `src/views/bookmarks.js` — bookmark domain badge, 'web' fallback
 */

/**
 * Extract the display hostname of a URL, returning `fallback` when the URL
 * cannot be parsed. Empty hostnames (e.g. `mailto:` URLs) yield `''` — the
 * fallback is substituted only for a parse failure.
 *
 * @param {string} url
 * @param {string} [fallback='']
 * @returns {string}
 */
export function extractDomain(url, fallback = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return fallback;
  }
}

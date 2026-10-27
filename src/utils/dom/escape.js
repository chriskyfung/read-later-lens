/**
 * @fileoverview Output-encoding / URL-safety helpers. These are security
 * helpers, not DOM helpers: they guard imported data before it becomes markup
 * or an `href`, so they live here (side-effect free, no document dependency).
 *
 * Re-exported by the public barrel src/utils/dom/index.js. See CONTRIBUTING.md:
 * never sanitize data on import (that corrupts data and breaks round-trips);
 * escape at the sink — inside markup builders — or prefer textContent.
 */

/**
 * Escape a string for safe insertion into `innerHTML` contexts.
 * Prefer `textContent` / `innerText` where possible.
 *
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Resolve a string into a safe absolute http(s) URL for use in `href`
 * attributes / properties.
 *
 * This is NOT HTML-escaping (use `escapeHtml` for that): it prevents the
 * `javascript:` / `data:` URL scheme attacks that survive attribute escaping
 * when a URL is assigned to an `href`. Returns the normalized `href` for valid
 * http(s) URLs, or `''` for anything else so the caller can fall back to a
 * safe placeholder (e.g. `'#'`).
 *
 * @param {string|null|undefined} url
 * @returns {string}  Safe http(s) URL string, or '' if unsafe/unparseable.
 */
export function safeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

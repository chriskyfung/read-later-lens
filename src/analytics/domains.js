/**
 * @fileoverview Domain analytics — top-N domains by bookmark count.
 */

/**
 * Extract `www.`-stripped hostnames and return sorted [domain, count] pairs.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} bookmarks
 * @param {number} [limit=15]
 * @returns {Array<[string, number]>} sorted desc by count
 */
import { extractDomain } from '../utils/url.js';

export function topDomains(list, limit = 15) {
  const map = new Map();
  for (const b of list) {
    const d = extractDomain(b.url);
    if (d) map.set(d, (map.get(d) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

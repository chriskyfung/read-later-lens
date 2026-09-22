/**
 * @fileoverview Pure concept-linkage graph builder.
 *
 * Derives the node/link topology used by the D3 graph view: each node carries
 * its domain (for the colour scale) and degree (for sizing), and links are
 * pairwise cosine-similarity edges above a threshold. Kept DOM- and d3-free so
 * the topology rules are unit-testable.
 *
 * Matches the original monolith: links when `cosineSimilarity > 0.15`, degree
 * incremented on both endpoints, `'unknown'` domain fallback, `www.` stripped.
 */

import { cosineSimilarity } from './similarity.js';

/** Monolith cap for the graph (top 50 filtered bookmarks). */
export const LINKAGE_LIMIT = 50;
/** Monolith similarity threshold (strictly greater than). */
export const LINKAGE_THRESHOLD = 0.15;

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} bookmarks
 * @param {{ limit?: number, threshold?: number }} [options]
 * @returns {{
 *   nodes: { id: string, title: string, url: string, domain: string, degree: number, tags: string[] }[],
 *   links: { source: string, target: string, value: number }[],
 *   domains: Set<string>,
 * }}
 */
export function buildLinkageGraph(bookmarks, options = {}) {
  const limit = options.limit ?? LINKAGE_LIMIT;
  const threshold = options.threshold ?? LINKAGE_THRESHOLD;
  const selected = bookmarks.slice(0, limit);

  const domains = new Set();
  const nodes = selected.map((b) => {
    let domain = 'unknown';
    try {
      domain = new URL(b.url).hostname.replace('www.', '');
    } catch {
      // Invalid URL — keep the 'unknown' fallback (monolith parity).
    }
    domains.add(domain);
    return { id: b.id, title: b.title, url: b.url, domain, degree: 0, tags: b.tags || [] };
  });

  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const sim = cosineSimilarity(selected[i], selected[j]);
      if (sim > threshold) {
        links.push({ source: nodes[i].id, target: nodes[j].id, value: sim });
        nodes[i].degree++;
        nodes[j].degree++;
      }
    }
  }

  return { nodes, links, domains };
}

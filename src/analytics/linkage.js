/**
 * @fileoverview Pure concept-linkage graph builder.
 *
 * Derives the node/link topology used by the D3 graph view: each node carries
 * its domain (for the colour scale) and degree (for sizing), and links are
 * pairwise cosine-similarity edges above a threshold. Kept DOM- and d3-free so
 * the topology rules are unit-testable.
 *
 * Matches the original monolith: links when the cosine similarity of a pair is
 * strictly greater than the threshold, degree incremented on both endpoints,
 * 'unknown' domain fallback, 'www.' leading prefix stripped.
 *
 * One opt-in deviation, default-off: `weighting: 'tfidf'` scales each shared
 * term by its inverse document frequency (see `buildIdf` /
 * `cosineScoreWeighted` in similarity.js) before the same threshold. Generic
 * words that appear in many documents ('ai', 'news') then contribute less,
 * which collapses hairball clusters while distinctive pairs survive. The
 * default 'tf' is byte-identical to the monolith.
 */

import { bookmarkTokenFreq, buildIdf, cosineScore, cosineScoreWeighted } from './similarity.js';
import { extractDomain } from '../utils/url.js';

/** Monolith cap for the graph (top 50 filtered bookmarks). */
export const LINKAGE_LIMIT = 50;
/** Monolith similarity threshold (strictly greater than). */
export const LINKAGE_THRESHOLD = 0.15;

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} bookmarks
 * @param {{ limit?: number, threshold?: number,
 *   weighting?: 'tf'|'tfidf' }} [options]
 * @returns {{
 *   nodes: { id: string, title: string, url: string, domain: string, degree: number, tags: string[] }[],
 *   links: { source: string, target: string, value: number }[],
 *   domains: Set<string>,
 * }}
 */
export function buildLinkageGraph(bookmarks, options = {}) {
  const limit = options.limit ?? LINKAGE_LIMIT;
  const threshold = options.threshold ?? LINKAGE_THRESHOLD;
  const weighting = options.weighting ?? 'tf';
  const selected = bookmarks.slice(0, limit);

  const { nodes, domains } = buildGraphNodes(selected);
  const freqs = selected.map(bookmarkTokenFreq); // one tokenizing pass per document
  const idf = weighting === 'tfidf' ? buildIdf(freqs) : null;
  const links = buildLinks(nodes, freqs, threshold, idf);

  return { nodes, links, domains };
}

/**
 * Derive node records and the domain set from a selection — the cheap half of
 * the graph build (one `extractDomain` per document, no tokenizing and no
 * pairwise scoring).
 *
 * Exposed separately so the linkage view can paint a focused node before
 * paying for the O(n^2) link pass. `degree` is 0 here; only the link pass
 * (which the caller runs later) can know the real values.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} selected
 *   Already-limited selection — this function does NOT re-apply `LINKAGE_LIMIT`.
 * @returns {{ nodes: { id: string, title: string, url: string, domain: string, degree: number, tags: string[] }[], domains: Set<string> }}
 */
export function buildGraphNodes(selected) {
  return buildNodes(selected);
}

/** Derive node records and the domain set from a filtered selection. */
function buildNodes(selected) {
  const domains = new Set();
  const nodes = selected.map((b) => {
    const domain = extractDomain(b.url, 'unknown');
    domains.add(domain);
    return { id: b.id, title: b.title, url: b.url, domain, degree: 0, tags: b.tags || [] };
  });
  return { nodes, domains };
}

/**
 * Build pairwise links above the threshold, incrementing both endpoints' degree.
 *
 * @param {{ id: string }[]} nodes
 * @param {Map<string, number>[]} freqs
 * @param {number} threshold
 * @param {Map<string, number>|null} idf null → plain TF scoring (monolith)
 */
function buildLinks(nodes, freqs, threshold, idf = null) {
  const score = idf ? cosineScoreWeighted : cosineScore;
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const sim = idf ? score(freqs[i], freqs[j], idf) : score(freqs[i], freqs[j]);
      if (sim > threshold) {
        links.push({ source: nodes[i].id, target: nodes[j].id, value: sim });
        nodes[i].degree++;
        nodes[j].degree++;
      }
    }
  }
  return links;
}

/**
 * @fileoverview Cosine similarity on tokenized bookmark content.
 *
 * Used by both the D3 linkage graph and the similarity recommendations modal.
 * Math matches the original monolith: dot product over term-frequency maps of
 * (title + article_preview).
 *
 * Architecture: two public APIs over one shared scoring core.
 * - `bookmarkTokenFreq()` tokenizes and counts.
 * - `cosineScore()` is the single scoring core (pre-computed freq maps in, score out).
 * - `cosineSimilarity()` and `mostSimilar()` are thin facades over `cosineScore()`,
 *   so the scoring math cannot drift between the graph and the recommendations.
 *
 * Note: the linkage graph builds each document's frequency map once (see
 * `buildLinkageGraph` in `src/analytics/linkage.js`) and re-uses it across
 * every pairwise score.
 */

import { bookmarkText, tokenizeFrequency } from './tokenize.js';

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {Map<string, number>}
 */
export function bookmarkTokenFreq(b) {
  return tokenizeFrequency(bookmarkText(b));
}

/**
 * Cosine similarity from two pre-computed term-frequency maps.
 *
 * Core math: dot product over the combined vocabulary, divided by the product
 * of the L2 norms of the two frequency vectors. Returns 0 when either vector
 * is empty (no shared or no meaningful tokens).
 *
 * @param {Map<string, number>} freqA
 * @param {Map<string, number>} freqB
 * @returns {number} 0..1
 */
export function cosineScore(freqA, freqB) {
  const vocab = new Set([...freqA.keys(), ...freqB.keys()]);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const term of vocab) {
    const ca = freqA.get(term) || 0;
    const cb = freqB.get(term) || 0;
    dot += ca * cb;
    normA += ca * ca;
    normB += cb * cb;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} a
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {number} 0..1
 */
export function cosineSimilarity(a, b) {
  return cosineScore(bookmarkTokenFreq(a), bookmarkTokenFreq(b));
}

/**
 * Rank all bookmarks by similarity to a target, excluding the target itself.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} list
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} target
 * @param {number} [top=5]
 * @returns {{ doc: import('../model/BookmarkRecord.js').BookmarkRecord, score: number }[]}
 */
export function mostSimilar(list, target, top = 5) {
  const targetFreq = bookmarkTokenFreq(target);

  const results = list
    .filter((b) => b.id !== target.id)
    .map((b) => ({ doc: b, score: cosineScore(targetFreq, bookmarkTokenFreq(b)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);

  return results;
}

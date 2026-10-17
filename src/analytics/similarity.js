/**
 * @fileoverview Cosine similarity on tokenized bookmark content.
 *
 * Used by both the D3 linkage graph and the similarity recommendations modal.
 * Math matches the original monolith: dot product over term-frequency maps of
 * (title + article_preview).
 *
 * Architecture: two public APIs over one shared scoring core.
 * - `bookmarkTokenFreq()` splits via the universal `Intl.Segmenter`
 *   splitter (`extractPlainTerms`, routed by `documentLanguage`) and
 *   counts. It was migrated off the legacy whitespace+regex tokenizer:
 *   the math below is unchanged, but token-level values shifted for CJK
 *   documents (dictionary words instead of overlapping bigram fragments)
 *   and contractions ("don't" no longer invents a shared 'don' token) —
 *   pinned in tests/similarity-segmenter.test.js.
 * - `cosineScore()` is the single scoring core (pre-computed freq maps in, score out).
 * - `cosineSimilarity()` and `mostSimilar()` are thin facades over `cosineScore()`,
 *   so the scoring math cannot drift between the graph and the recommendations.
 *
 * Note: the linkage graph builds each document's frequency map once (see
 * `buildLinkageGraph` in `src/analytics/linkage.js`) and re-uses it across
 * every pairwise score.
 */

import { bookmarkText } from './tokenize.js';
import { extractPlainTerms, documentLanguage } from './keywords.js';

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {Map<string, number>}
 */
export function bookmarkTokenFreq(b) {
  return new Map(extractPlainTerms(bookmarkText(b), documentLanguage(b)));
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
 * Inverse document frequency over the union vocabulary of pre-computed
 * frequency maps — the TF-IDF half of the linkage toggle.
 *
 * Smoothed (`log(1 + N/(1+df))`) so a term present in every document keeps
 * a small positive weight instead of zeroing its pair's dot product, and
 * rare terms rise toward `log(1+N)`. O(V) memory, built once per graph.
 *
 * @param {Map<string, number>[]} freqs one frequency map per document
 * @returns {Map<string, number>} idf weight per vocabulary term
 */
export function buildIdf(freqs) {
  const df = new Map();
  for (const freq of freqs) {
    for (const term of freq.keys()) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }
  const idf = new Map();
  for (const [term, count] of df) {
    idf.set(term, Math.log(1 + freqs.length / (1 + count)));
  }
  return idf;
}

/**
 * Cosine similarity with per-term IDF weighting: each count is scaled by
 * `idf.get(term) ?? 1` before the same dot/norm math as `cosineScore`, so
 * shared generic terms (high df → low idf) contribute less than shared
 * distinctive ones. With a flat idf map (all 1) this IS `cosineScore`.
 *
 * @param {Map<string, number>} freqA
 * @param {Map<string, number>} freqB
 * @param {Map<string, number>} idf from `buildIdf` over the same corpus
 * @returns {number} 0..1
 */
export function cosineScoreWeighted(freqA, freqB, idf) {
  const vocab = new Set([...freqA.keys(), ...freqB.keys()]);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const term of vocab) {
    const weight = idf.get(term) ?? 1;
    const ca = (freqA.get(term) || 0) * weight;
    const cb = (freqB.get(term) || 0) * weight;
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
 * @param {{ weighting?: 'tf'|'tfidf' }} [options]
 *   - `'tf'` (default): plain cosine over term-frequency maps — byte-identical
 *     to the monolith.
 *   - `'tfidf'`: each shared term scaled by its inverse document frequency over
 *     `list` (see `buildIdf` / `cosineScoreWeighted`), so generic terms that
 *     appear in many documents contribute less than distinctive ones.
 * @returns {{ doc: import('../model/BookmarkRecord.js').BookmarkRecord, score: number }[]}
 */
export function mostSimilar(list, target, top = 5, options = {}) {
  const weighting = options.weighting ?? 'tf';
  const freqs = list.map(bookmarkTokenFreq); // one tokenizing pass for the corpus
  const idf = weighting === 'tfidf' ? buildIdf(freqs) : null;
  const targetFreq = bookmarkTokenFreq(target);
  const score = idf ? cosineScoreWeighted : cosineScore;

  const results = list
    .map((b, i) => ({ doc: b, freq: freqs[i] }))
    .filter(({ doc }) => doc.id !== target.id)
    .map(({ doc, freq }) => ({
      doc,
      score: idf ? score(targetFreq, freq, idf) : score(targetFreq, freq),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);

  return results;
}

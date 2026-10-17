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
import { MIN_AUTO_N, MIN_IDF_SPREAD, AUTO_K } from './constants.js';

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

/**
 * Rank all bookmarks by similarity to a target with automatic TF-IDF blending.
 *
 * Automatically picks between plain TF and TF-IDF scoring based on the corpus
 * and the target:
 * - Small corpora (below MIN_AUTO_N) or flat vocabularies (below
 *   MIN_IDF_SPREAD) stay plain TF — IDF estimates are noise there.
 * - Otherwise lambda = sigmoid((centerIdf - targetSpecificity) * AUTO_K), so a
 *   generic target (low specificity) leans into IDF while a distinctive target
 *   leans into TF. Lambda is returned alongside the ranked results and the mode
 *   label ('tf' | 'blend' | 'tfidf') is fit for a UI status line.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} list
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} target
 * @param {number} [top=5]
 * @returns {{
 *   results: { doc: import('../model/BookmarkRecord.js').BookmarkRecord, score: number }[],
 *   lambda: number,
 *   mode: 'tf' | 'blend' | 'tfidf',
 * }}
 */
export function mostSimilarAuto(list, target, top = 5) {
  const N = list.length;
  const freqs = list.map(bookmarkTokenFreq);
  const targetFreq = bookmarkTokenFreq(target);

  if (N < MIN_AUTO_N) {
    return {
      results: rankByWeights(list, freqs, targetFreq, target.id, null, 0, top),
      lambda: 0,
      mode: 'tf',
    };
  }

  const idf = buildIdf(freqs);
  const idfValues = [...idf.values()];
  const spread = Math.max(...idfValues) - Math.min(...idfValues);
  if (spread < MIN_IDF_SPREAD) {
    return {
      results: rankByWeights(list, freqs, targetFreq, target.id, null, 0, top),
      lambda: 0,
      mode: 'tf',
    };
  }

  const centerIdf = (Math.min(...idfValues) + Math.max(...idfValues)) / 2;
  const specificity = targetSpecificity(targetFreq, idf);
  const lambda = sigmoid((centerIdf - specificity) * AUTO_K);

  return {
    results: rankByWeights(list, freqs, targetFreq, target.id, idf, lambda, top),
    lambda,
    mode: lambda < 0.3 ? 'tf' : lambda > 0.7 ? 'tfidf' : 'blend',
  };
}

/**
 * Rank candidates by a convex blend of TF and TF-IDF cosine scores.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} list
 * @param {Map<string, number>[]} freqs one frequency map per list entry
 * @param {Map<string, number>} targetFreq
 * @param {Map<string, number> | null} idf null -> plain TF
 * @param {number} lambda TF-IDF mix (0 = pure TF, 1 = pure TF-IDF)
 * @param {number} top
 * @returns {{ doc: import('../model/BookmarkRecord.js').BookmarkRecord, score: number }[]}
 */
function rankByWeights(list, freqs, targetFreq, targetId, idf, lambda, top) {
  const score = idf
    ? (fa, fb) => (1 - lambda) * cosineScore(fa, fb) + lambda * cosineScoreWeighted(fa, fb, idf)
    : cosineScore;
  return list
    .map((b, i) => ({ doc: b, freq: freqs[i] }))
    .filter(({ doc }) => doc.id !== targetId)
    .map(({ doc, freq }) => ({ doc, score: score(targetFreq, freq) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

/**
 * Mean IDF of the target's terms; terms absent from the corpus weight 1.
 *
 * @param {Map<string, number>} targetFreq
 * @param {Map<string, number>} idf
 * @returns {number}
 */
export function targetSpecificity(targetFreq, idf) {
  const terms = [...targetFreq.keys()];
  if (terms.length === 0) return 1;
  const sum = terms.reduce((acc, t) => acc + (idf.get(t) ?? 1), 0);
  return sum / terms.length;
}

/**
 * Logistic sigmoid, 0..1, sigmoid(0) = 0.5.
 *
 * @param {number} x
 * @returns {number}
 */
export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

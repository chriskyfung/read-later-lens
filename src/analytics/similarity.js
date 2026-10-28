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
import { cosineScore, buildIdf, targetSpecificity, sigmoid } from './scoring.js';

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {Map<string, number>}
 */
export function bookmarkTokenFreq(b) {
  return new Map(extractPlainTerms(bookmarkText(b), documentLanguage(b)));
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
 *     `list` (see `buildIdf` / `cosineScore` in `scoring.js`), so generic terms that
 *     appear in many documents contribute less than distinctive ones.
 * @returns {{ doc: import('../model/BookmarkRecord.js').BookmarkRecord, score: number }[]}
 */
export function mostSimilar(list, target, top = 5, options = {}) {
  const weighting = options.weighting ?? 'tf';
  const freqs = list.map(bookmarkTokenFreq); // one tokenizing pass for the corpus
  const idf = weighting === 'tfidf' ? buildIdf(freqs) : null;
  const targetFreq = bookmarkTokenFreq(target);
  const lambda = weighting === 'tfidf' ? 1 : 0;

  return rankByWeights(list, freqs, targetFreq, target.id, idf, lambda, top);
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
  const score = (fa, fb) => (1 - lambda) * cosineScore(fa, fb) + lambda * cosineScore(fa, fb, idf);
  return list
    .map((b, i) => ({ doc: b, freq: freqs[i] }))
    .filter(({ doc }) => doc.id !== targetId)
    .map(({ doc, freq }) => ({ doc, score: score(targetFreq, freq) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

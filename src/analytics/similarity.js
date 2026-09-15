/**
 * @fileoverview Cosine similarity on tokenized bookmark content.
 *
 * Used by both the D3 linkage graph and the similarity recommendations modal.
 * Math matches the original monolith: dot product over term-frequency maps of
 * (title + article_preview).
 */

import { tokenizeText } from './tokenize.js';

/**
 * Token frequency map for a bookmark's title + preview.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {Map<string, number>}
 */
export function bookmarkTokenFreq(b) {
  const freq = new Map();
  const text = (b.title || '') + ' ' + (b.article_preview || '');
  for (const t of tokenizeText(text)) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

/**
 * Cosine similarity between two bookmarks (title + preview space).
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} a
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} b
 * @returns {number} 0..1
 */
export function cosineSimilarity(a, b) {
  const freqA = bookmarkTokenFreq(a);
  const freqB = bookmarkTokenFreq(b);

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
    .map((b) => {
      const freqB = bookmarkTokenFreq(b);
      const vocab = new Set([...targetFreq.keys(), ...freqB.keys()]);
      let dot = 0;
      let normA = 0;
      let normB = 0;

      for (const term of vocab) {
        const ta = targetFreq.get(term) || 0;
        const tb = freqB.get(term) || 0;
        dot += ta * tb;
        normA += ta * ta;
        normB += tb * tb;
      }

      const score = normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
      return { doc: b, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, top);

  return results;
}

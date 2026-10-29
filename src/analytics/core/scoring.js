/**
 * @fileoverview Pure scoring math for cosine / TF-IDF similarity.
 *
 * No bookmark or tokenization concepts — just term-frequency maps in, a score out.
 * Shared by `src/analytics/similarity.js` (recommendations) and
 * `src/analytics/linkage.js` (graph), so the scoring math cannot drift between
 * the two consumers.
 *
 * `cosineScore(freqA, freqB)` is plain cosine. `cosineScore(freqA, freqB, idf)`
 * weights each count by its IDF before the same dot/norm math — a flat idf map
 * (all 1s) reduces exactly to plain cosine.
 */

export function cosineScore(freqA, freqB, idf = null) {
  const vocab = new Set([...freqA.keys(), ...freqB.keys()]);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const term of vocab) {
    const weight = idf ? (idf.get(term) ?? 1) : 1;
    const ca = (freqA.get(term) || 0) * weight;
    const cb = (freqB.get(term) || 0) * weight;
    dot += ca * cb;
    normA += ca * ca;
    normB += cb * cb;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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

export function targetSpecificity(targetFreq, idf) {
  const terms = [...targetFreq.keys()];
  if (terms.length === 0) return 1;
  const sum = terms.reduce((acc, t) => acc + (idf.get(t) ?? 1), 0);
  return sum / terms.length;
}

export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

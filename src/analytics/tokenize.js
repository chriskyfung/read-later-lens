/**
 * @fileoverview Light-weight tokenizer — CJK bigrams + English stemming.
 *
 * Mirrors the original `tokenizeText` / `simpleStem` exactly so word-cloud and
 * similarity results remain identical after the refactor.
 */

import { ENGLISH_STOPWORDS, CJK_STOPWORDS } from './stopwords.js';

/**
 * Light English stemmer (original behaviour, preserved).
 *
 * @param {string} word
 * @returns {string}
 */
export function simpleStem(word) {
  if (word.length < 4) return word;
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) return word.slice(0, -1);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  return word;
}

/**
 * Tokenize text into keyword fragments for frequency analysis.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeText(text) {
  if (!text) return [];
  const cleaned = text.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5\u3040-\u30ff]/g, ' ');
  const rawTokens = cleaned.split(/\s+/);
  const tokens = [];

  for (let word of rawTokens) {
    if (!word || word.length < 2) continue;

    // English-like token
    if (/^[a-z0-9]+$/.test(word)) {
      if (!ENGLISH_STOPWORDS.has(word) && !/^\d+$/.test(word)) {
        tokens.push(simpleStem(word));
      }
    } else if (/[\u4e00-\u9fa5\u3040-\u30ff]/.test(word)) {
      // CJK / CJK-mixed token — emit bigrams
      for (let i = 0; i < word.length - 1; i++) {
        const bigram = word.substring(i, i + 2);
        if (!CJK_STOPWORDS.has(bigram)) {
          tokens.push(bigram);
        }
      }
    }
  }
  return tokens;
}

/**
 * Build a frequency map from tokenized text.
 *
 * @param {string} text
 * @returns {Map<string, number>}
 */
export function tokenizeFrequency(text) {
  const freq = new Map();
  for (const t of tokenizeText(text)) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

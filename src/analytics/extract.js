/**
 * @fileoverview Keyword term extraction.
 *
 * Pure extraction functions (compromise-backed English terms, plain splitter
 * terms, CJK terms) plus helpers. Reads the loaded engine via `getNlp()`
 * from `./engine.js` so the lazy-loading lifecycle stays isolated.
 */

import { simpleStem } from './core/tokenize.js';
import { BASE_EN, CLOUD_EN, cjkStopsetFor } from './core/stopwords.js';
import { DIGITS_ONLY, MIN_TOKEN_LENGTH } from './core/constants.js';
import { segmentCjkWords, segmentWords, LATIN_WORD } from './core/segmentZh.js';
import { getNlp } from './engine.js';

/** Strips everything a term must not keep: punctuation, spaces, CJK runs. */
const TERM_CLEAN = /[^a-z0-9']+/g;

function cleanWord(word) {
  return word.toLowerCase().replace(TERM_CLEAN, '');
}

function isNoise(word, stopset) {
  return word.length < MIN_TOKEN_LENGTH || DIGITS_ONLY.test(word) || stopset.has(word);
}

function trimEdges(words) {
  let start = 0;
  let end = words.length;
  while (start < end && isNoise(words[start], CLOUD_EN)) start++;
  while (end > start && isNoise(words[end - 1], CLOUD_EN)) end--;
  return words.slice(start, end);
}

function splitClean(raw) {
  return raw.split(/\s+/).map(cleanWord).filter(Boolean);
}

const lemmaCache = new Map();

function lemmaOf(word) {
  const nlp = getNlp();
  let lemma = lemmaCache.get(word);
  if (lemma === undefined) {
    lemma = nlp(word).normalize({ plurals: true, verbs: true }).text().trim().toLowerCase();
    lemmaCache.set(word, lemma);
  }
  return lemma || word;
}

function latinKeyFor(word) {
  const nlp = getNlp();
  return nlp ? lemmaOf(word) : simpleStem(word);
}

export function extractKeywordTerms(text) {
  const nlp = getNlp();
  if (!nlp || !text) return [];

  const doc = nlp(text);
  const terms = [];

  for (const raw of doc.match('#Noun').out('array')) {
    const [word] = trimEdges(splitClean(raw));
    if (word) terms.push({ key: lemmaOf(word), display: word, count: 1 });
  }

  for (const { normal, count } of doc.match('#Noun #Noun').out('freq')) {
    const words = trimEdges(splitClean(normal));
    if (words.length < 2 || words[0] === words[1]) continue;
    const display = words.join(' ');
    terms.push({ key: words.map(lemmaOf).join(' '), display, count });
  }

  return terms;
}

export function extractPlainTerms(text, lang = 'en', stopset = BASE_EN) {
  if (!text) return [];

  const freq = new Map();
  for (const raw of segmentWords(text, lang)) {
    const word = raw.replace(/'s$/, '');
    if (!word) continue;
    if (LATIN_WORD.test(word)) {
      if (isNoise(word, stopset)) continue;
      const term = simpleStem(word);
      freq.set(term, (freq.get(term) || 0) + 1);
    } else {
      if (word.length < MIN_TOKEN_LENGTH || cjkStopsetFor(lang).has(word)) continue;
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }
  return [...freq];
}

export function extractPlainEnglishTerms(text) {
  return extractPlainTerms(text, 'en', CLOUD_EN);
}

export function extractCjkKeywordTerms(text, locale = 'zh') {
  if (!text) return [];
  const terms = [];
  for (const word of segmentCjkWords(text, locale)) {
    if (isNoise(word, CLOUD_EN)) continue;
    terms.push({ key: LATIN_WORD.test(word) ? latinKeyFor(word) : word, display: word, count: 1 });
  }
  return terms;
}

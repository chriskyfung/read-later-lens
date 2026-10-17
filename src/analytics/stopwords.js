/**
 * @fileoverview Stopword lists for English and CJK tokenization.
 *
 * Two English sets with different jobs:
 * - `BASE_EN` — function words + URL/boilerplate junk. The SCORER's set
 *   (similarity, linkage): content-ish words like 'time', 'new', 'way' stay
 *   in the vectors, because two docs sharing "time management" ARE similar.
 * - `CLOUD_EN` — `BASE_EN` plus the aesthetic overlay. The WORD CLOUD's set,
 *   byte-identical to the original monolith's single list, so cloud output
 *   is unchanged by the split (pinned in tests/analytics.test.js).
 *
 * CJK: `CJK_STOPWORDS` (zh) is shared by both paths — no aesthetic overlay
 * yet, which needs corpus evidence rather than guesses. Japanese gets its
 * own `JA_STOPWORDS` (multi-char function words; single kana particles are
 * already dropped by `MIN_TOKEN_LENGTH`), routed via `cjkStopsetFor` so the
 * Chinese list never half-filters Japanese documents.
 */

/** @type {ReadonlySet<string>} */
export const BASE_EN = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  "aren't",
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  "can't",
  'cannot',
  'could',
  "couldn't",
  'did',
  "didn't",
  'do',
  'does',
  "doesn't",
  'doing',
  "don't",
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  "hadn't",
  'has',
  "hasn't",
  'have',
  "haven't",
  'having',
  'he',
  "he'd",
  "he'll",
  "he's",
  'her',
  'here',
  "here's",
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  "how's",
  'i',
  "i'd",
  "i'll",
  "i'm",
  "i've",
  'if',
  'in',
  'into',
  'is',
  "isn't",
  'it',
  "it's",
  'its',
  'itself',
  "let's",
  'me',
  'more',
  'most',
  "mustn't",
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'ought',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  "shan't",
  'she',
  "she'd",
  "she'll",
  "she's",
  'should',
  "shouldn't",
  'so',
  'some',
  'such',
  'than',
  'that',
  "that's",
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  "there's",
  'these',
  'they',
  "they'd",
  "they'll",
  "they're",
  "they've",
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  "wasn't",
  'we',
  "we'd",
  "we'll",
  "we're",
  "we've",
  'were',
  "weren't",
  'what',
  "what's",
  'when',
  "when's",
  'where',
  "where's",
  'which',
  'while',
  'who',
  "who's",
  'whom',
  'why',
  "why's",
  'with',
  "won't",
  'would',
  "wouldn't",
  'you',
  "you'd",
  "you'll",
  "you're",
  "you've",
  'your',
  'yours',
  'yourself',
  'yourselves',
  'http',
  'https',
  'com',
  'org',
  'net',
  'www',
  'html',
  'amp',
]);

/**
 * Aesthetic overlay — high-frequency content-ish words that dominate a
 * word cloud but carry little topic signal ('time', 'new', 'way'…).
 * Dropped ONLY by the cloud; the scorer keeps them (see fileoverview).
 */
const CLOUD_EN_AESTHETIC = new Set([
  'ever',
  'get',
  'also',
  'like',
  'just',
  'make',
  'time',
  'new',
  'way',
  'know',
  'one',
  'two',
  'see',
  'well',
  'much',
  'even',
  'us',
]);

/** Word-cloud English stop set: `BASE_EN` + aesthetic overlay. */
export const CLOUD_EN = new Set([...BASE_EN, ...CLOUD_EN_AESTHETIC]);

/** @type {ReadonlySet<string>} */
export const CJK_STOPWORDS = new Set([
  '的',
  '了',
  '在',
  '是',
  '我',
  '有',
  '和',
  '就',
  '不',
  '人',
  '都',
  '一',
  '一個',
  '上',
  '也',
  '很',
  '到',
  '說',
  '要',
  '去',
  '你',
  '會',
  '著',
  '沒有',
  '看',
  '好',
  '自己',
  '這',
  '那',
  '就',
  '以',
  '或',
  '對',
]);

/**
 * Japanese multi-char function words (particles/assistants/politeness
 * endings). Single kana particles ('の','は','が'…) are already dropped by
 * `MIN_TOKEN_LENGTH` in the caller. Seeded conservatively — Japanese text
 * is rare in this corpus; extend from real imports rather than guesses.
 */
export const JA_STOPWORDS = new Set([
  'ので',
  'のに',
  'こと',
  'もの',
  'ため',
  'よう',
  'ところ',
  'という',
  'として',
  'について',
  'のように',
  'です',
  'ます',
  'でした',
  'ました',
  'でしょう',
]);

/**
 * Japanese set = shared kanji function words + JA-specific entries. Built
 * once at module load — `cjkStopsetFor` is called per-word inside
 * `segmentCjkWords`, so it must never allocate.
 */
const JA_COMBINED = new Set([...CJK_STOPWORDS, ...JA_STOPWORDS]);

/**
 * Language-routed CJK stop set: Japanese gets its own list (plus the shared
 * `CJK_STOPWORDS` for kanji function words like '的'), Chinese keeps the
 * monolith list — so the Chinese list never half-filters Japanese docs.
 *
 * @param {string} lang 'zh' (default) | 'ja'
 * @returns {ReadonlySet<string>}
 */
export function cjkStopsetFor(lang = 'zh') {
  return lang === 'ja' ? JA_COMBINED : CJK_STOPWORDS;
}

/**
 * @fileoverview Shared text-analysis constants: Unicode ranges, tokenizer
 * regexes, and token-policy thresholds.
 *
 * One source of truth so the character-set policy cannot drift between the
 * tokenizer (`tokenize.js`) and the language heuristic (`detectLanguage.js`).
 * Pure extraction — patterns and values are byte-identical to the literals
 * they replace.
 */

/* ---- Unicode ranges ---- */

/** CJK Unified Ideographs (common Han). */
export const CJK_IDEOGRAPHS = '\u4e00-\u9fa5';
/** Japanese kana: Hiragana + Katakana. */
export const KANA = '\u3040-\u30ff';
/** Everything the tokenizer treats as CJK: ideographs + kana. */
export const CJK_RANGES = `${CJK_IDEOGRAPHS}${KANA}`;

/* ---- Tokenizer regexes ---- */
/** Whitespace run — token boundary. */
export const WHITESPACE = /\s+/;

/** Everything *not* a Latin word char, whitespace, or CJK — replaced with ' '. */
export const INVALID_CHARS = new RegExp(`[^\\w\\s${CJK_RANGES}]`, 'g');
/** A word containing any CJK character (routes to bigram emission). */
export const CJK_CHAR = new RegExp(`[${CJK_RANGES}]`);
/** Pure ASCII alphanumeric token (routes to stemming). */
export const ENGLISH_TOKEN = /^[a-z0-9]+$/;
/** Pure digits (dropped). */
export const DIGITS_ONLY = /^\d+$/;

/* ---- Token policy ---- */

/** Minimum token length; shorter fragments are dropped. */
export const MIN_TOKEN_LENGTH = 2;

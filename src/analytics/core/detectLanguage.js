/**
 * @fileoverview Language detection — CJK heuristic.
 *
 * Lightweight proxy for a full-language detector. The original app already
 * uses a CJK/ja heuristic; we preserve it here so behaviour matches
 * exactly. A heavier franc-based detector can be swapped in later if the
 * bundle budget makes sense.
 */

import { CJK_IDEOGRAPHS, KANA } from './constants.js';

const IDEOGRAPH_RE = new RegExp(`[${CJK_IDEOGRAPHS}]`, 'g');
const JA_RE = new RegExp(`[${KANA}]`, 'g');

/** Minimum kana count that triggers Japanese; minimum ideograph count that triggers Chinese. */
const JA_MIN_COUNT = 3;
const IDEOGRAPH_MIN_COUNT = 3;

/**
 * @param {string} text
 * @returns {'en' | 'zh' | 'ja'}
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  const ideographs = (text.match(IDEOGRAPH_RE) || []).length;
  const ja = (text.match(JA_RE) || []).length;
  if (ja > JA_MIN_COUNT) return 'ja';
  if (ideographs > IDEOGRAPH_MIN_COUNT) return 'zh';
  return 'en';
}

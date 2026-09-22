/**
 * @fileoverview Language detection — CJK heuristic.
 *
 * Lightweight proxy for a full-language detector. The original app already
 * uses a CJK/ja heuristic; we preserve it here so behaviour matches
 * exactly. A heavier franc-based detector can be swapped in later if the
 * bundle budget makes sense.
 */

const CJK_RE = /[\u4e00-\u9fa5]/g;
const JA_RE = /[\u3040-\u30ff]/g;

/**
 * @param {string} text
 * @returns {'en' | 'zh' | 'ja'}
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  const cjk = (text.match(CJK_RE) || []).length;
  const ja = (text.match(JA_RE) || []).length;
  if (ja > 3) return 'ja';
  if (cjk > 3) return 'zh';
  return 'en';
}

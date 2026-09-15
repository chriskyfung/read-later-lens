/**
 * @fileoverview Language detection (CJK heuristic) extracted from the monolith.
 *
 * Returns 'ja' when more than 3 kana characters are present, 'zh' when more
 * than 3 Han characters are present, otherwise 'en'. Matches the original
 * inline implementation exactly.
 */

/**
 * @param {string} text
 * @returns {'en' | 'zh' | 'ja'}
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  const cjkRegex = /[\u4e00-\u9fa5]/g;
  const jaRegex = /[\u3040-\u30ff]/g;
  const cjkMatches = text.match(cjkRegex) || [];
  const jaMatches = text.match(jaRegex) || [];

  if (jaMatches.length > 3) return 'ja';
  if (cjkMatches.length > 3) return 'zh';
  return 'en';
}

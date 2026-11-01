/**
 * @fileoverview Keyword extraction barrel — public surface for the split.
 *
 * Re-exports the engine lifecycle (from ./engine.js) and the term-extraction
 * helpers (from ./extract.js) so existing import paths (src/analytics/index.js,
 * tests) keep working. Internal modules import from the submodules directly.
 */

export {
  loadKeywordsEngine,
  keywordsReady,
  keywordsFailed,
  getNlp,
  getEngineState,
  documentLanguage,
  needsKeywordEngine,
} from './engine.js';

export {
  extractKeywordTerms,
  extractPlainTerms,
  extractPlainEnglishTerms,
  extractCjkKeywordTerms,
} from './extract.js';

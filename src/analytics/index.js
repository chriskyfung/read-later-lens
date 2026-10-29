/**
 * @fileoverview Analytics barrel — public API for external consumers.
 *
 * Importers should use this single entry point rather than reaching into
 * individual module files. Internal modules import from each other directly
 * (relative paths), never through this barrel.
 */

export { topDomains } from './domains.js';
export { buildLinkageGraph, buildGraphNodes, LINKAGE_LIMIT, LINKAGE_THRESHOLD } from './linkage.js';
export { mostSimilarAuto, mostSimilar, cosineSimilarity, bookmarkTokenFreq } from './similarity.js';
export { wordCloudFrequencies, wordCloudItems } from './wordcloud.js';
export {
  loadKeywordsEngine,
  keywordsReady,
  keywordsFailed,
  needsKeywordEngine,
  documentLanguage,
  extractPlainTerms,
  extractPlainEnglishTerms,
  extractCjkKeywordTerms,
  extractKeywordTerms,
} from './keywords.js';
export { detectLanguage } from './core/detectLanguage.js';

/**
 * @fileoverview Worker-scoped constants — re-exported from core modules so
 * the worker and main thread share one source of truth.
 *
 * These are pure values (regexes, Sets, numbers). Importing them into the
 * worker bundles their transitively-reachable modules into the worker chunk,
 * which is fine: they are small, dependency-free utilities.
 */

export { MIN_TOKEN_LENGTH, DIGITS_ONLY } from '../core/constants.js';
export {
  BASE_EN,
  CLOUD_EN,
  CJK_STOPWORDS,
  JA_STOPWORDS,
  cjkStopsetFor,
} from '../core/stopwords.js';
export { LATIN_WORD } from '../core/segmentZh.js';
export { simpleStem } from '../core/tokenize.js';

/** @type {ReadonlySet<string>} */
export const CLOUD_EN_AESTHETIC = new Set([
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

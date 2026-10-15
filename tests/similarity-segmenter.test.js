// Similarity migrates onto the universal Intl.Segmenter splitter; these
// pins prove the migration by DIVERGING from the legacy tokenizer's known
// defects (fail-first: both diverging pins fail on the legacy path).
// Scoring math (`cosineScore`) is untouched — only the tokens change.
import { describe, it, expect } from 'vitest';
import { cosineSimilarity, bookmarkTokenFreq } from '../src/analytics/similarity.js';

const mk = (title, preview = '') => ({ id: 'x', title, article_preview: preview });

describe('similarity on the segmented splitter', () => {
  it("drops the phantom 'don' token the legacy tokenizer invented from \"don't\"", () => {
    // Legacy: INVALID_CHARS turned "don't" into 'don' + 't', so two docs
    // sharing nothing but that accident still scored > 0.
    expect(cosineSimilarity(mk("don't panic"), mk('don arrived'))).toBe(0);
  });

  it('segments Chinese into dictionary words, never bigram fragments', () => {
    const freq = bookmarkTokenFreq(mk('機器學習研究'));
    expect(freq.get('機器')).toBe(1);
    expect(freq.get('學習')).toBe(1);
    expect(freq.get('研究')).toBe(1);
    expect(freq.get('器學')).toBeUndefined(); // legacy bigram fragment
  });

  it('keeps cross-language Latin runs keyed by the legacy stem', () => {
    // Same grouping contract as before: 'running' stems to 'runn' in both
    // an English document and a Chinese-routed one, so cosine still sees
    // the shared term.
    expect(bookmarkTokenFreq(mk('running shoes')).get('runn')).toBe(1);
    expect(bookmarkTokenFreq(mk('跑步的 running 研究')).get('runn')).toBe(1);
  });
});

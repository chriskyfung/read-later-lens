// Characterization pins for the DECLARED LEGACY FALLBACK (`tokenize.js`).
// `simpleStem` is load-bearing beyond the legacy splitter — it is the
// pre-engine grouping key (`latinKeyFor`) and the plain-path key = display
// contract (`extractPlainEnglishTerms`) — so these pins exist to make a
// future "delete the legacy tokenizer" cleanup fail loudly instead of
// silently changing grouping. Fail-first: N/A by design — the pins pass
// before and after the docs-only change they accompany; they guard the
// FUTURE deletion, not this commit.
import { describe, it, expect } from 'vitest';
import { simpleStem } from '../src/analytics/core/tokenize.js';

describe('simpleStem (legacy stemmer, load-bearing)', () => {
  it('stems the suffix rules in order, exactly as the original monolith', () => {
    expect(simpleStem('running')).toBe('runn'); // -ing (len > 5)
    expect(simpleStem('stories')).toBe('story'); // -ies → -y
    expect(simpleStem('boxes')).toBe('box'); // -es (len > 4)
    expect(simpleStem('shoes')).toBe('sho'); // -es quirk: strips 'es', not 'e'
    expect(simpleStem('walked')).toBe('walk'); // -ed (len > 4)
    expect(simpleStem('cats')).toBe('cat'); // -s (len > 3)
  });

  it('passes words through untouched when no rule applies', () => {
    expect(simpleStem('cat')).toBe('cat'); // shorter than 4 → no rules
    expect(simpleStem('run')).toBe('run'); // shorter than 4 → no rules
    expect(simpleStem('glass')).toBe('glass'); // -ss exception
    expect(simpleStem('search')).toBe('search'); // no matching suffix
  });
});

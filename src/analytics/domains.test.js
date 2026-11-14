/**
 * Tests for domain analytics — top-N domains by bookmark count.
 *
 * Colocated beside src/analytics/domains.js per the project's hybrid
 * test arrangement (AGENTS.md).
 *
 * Original location: tests/analytics.test.js (topDomains).
 */
import { describe, it, expect } from 'vitest';
import { topDomains } from './domains.js';

describe('topDomains', () => {
  it('strips www. and counts, sorted desc, capped', () => {
    const bms = [
      { id: '1', url: 'https://www.example.com/a' },
      { id: '2', url: 'https://example.com/b' },
      { id: '3', url: 'https://other.org/c' },
    ];
    expect(topDomains(bms)).toEqual([
      ['example.com', 2],
      ['other.org', 1],
    ]);
    expect(topDomains(bms, 1)).toEqual([['example.com', 2]]);
  });

  it('skips invalid URLs', () => {
    expect(
      topDomains([
        { id: '1', url: '::::' },
        { id: '2', url: 'https://ok.com/' },
      ]),
    ).toEqual([['ok.com', 1]]);
  });
});

import {
  domainChartEmptyStateHtml,
  domainBarClass,
  domainBarHtml,
} from '../src/components/domains/bar.js';
import { describe, it, expect } from 'vitest';

/**
 * Tests for the pure markup helpers extracted from src/views/domains.js.
 * They mirror the parity guards that the original monolith asserted in
 * tests/views-domains.test.js (exact empty-state span, bar classes and the
 * `${count} 篇文章 (${pct}%)` caption).
 */

describe('domain bar helpers', () => {
  it('exports empty state html identical to monolith', () => {
    const result = domainChartEmptyStateHtml();
    expect(result).toBe(
      '<span class="text-slate-500 text-xs flex justify-center py-10">尚無域名資料</span>',
    );
  });

  it('exports correct bar class list', () => {
    const result = domainBarClass();
    expect(result).toBe(
      'p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl hover:border-indigo-500/50 cursor-pointer transition',
    );
  });

  it('renders bar html correctly', () => {
    const html = domainBarHtml({ domain: 'example.com', count: 2, pct: 100 });
    expect(html).toContain('>example.com<');
    expect(html).toContain('2 篇文章 (100%)');
    expect(html).toContain('bg-indigo-500');
    expect(html).toContain('style="width: 100%"');
  });

  it('escapes the domain label defensively', () => {
    const html = domainBarHtml({ domain: '<script>', count: 1, pct: 50 });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
import {
  linkageEmptyStateHtml,
  linkageTooltipTagsHtml,
} from '../src/components/linkage/graph.js';
import { describe, it, expect } from 'vitest';

/**
 * Tests for the pure markup helpers extracted from src/views/linkage.js.
 * They mirror the parity guards that the original monolith asserted in
 * tests/views-linkage.test.js (exact guard-message div) and the tooltip tag
 * pill markup.
 */

describe('linkage graph helpers', () => {
  it('exports empty state html identical to monolith', () => {
    const result = linkageEmptyStateHtml();
    expect(result).toBe(
      '<div class="text-slate-500 text-xs flex items-center justify-center h-full">需要至少 2 筆書籤以構建關聯網絡拓撲圖</div>',
    );
  });

  it('renders tag pills joined together', () => {
    const html = linkageTooltipTagsHtml(['tech', 'fruit']);
    expect(html).toBe(
      '<span class="bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded text-[10px]">tech</span>' +
        '<span class="bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded text-[10px]">fruit</span>',
    );
  });

  it('returns an empty string for missing or empty tags', () => {
    expect(linkageTooltipTagsHtml(undefined)).toBe('');
    expect(linkageTooltipTagsHtml([])).toBe('');
  });
});
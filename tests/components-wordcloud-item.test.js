import {
  wordCloudEmptyStateHtml,
  wordCloudItemClass,
  wordCloudItemLabel,
} from '../src/components/wordcloud/item.js';
import { describe, it, expect } from 'vitest';

/**
 * Tests for the pure markup helpers extracted from src/views/wordcloud.js.
 * They mirror the parity guards that the original monolith asserted in
 * tests/views-wordcloud.test.js (W3–W5).
 */

describe('wordcloud item helpers', () => {
  it('exports empty state html identical to monolith', () => {
    const result = wordCloudEmptyStateHtml();
    expect(result).toBe('<span class=\"text-slate-500 text-xs\">尚無文字資料可分析</span>');
  });

  it('exports correct item class list', () => {
    const result = wordCloudItemClass();
    expect(result).toBe(
      'word-cloud-item inline-block font-bold cursor-pointer transition p-1.5 text-indigo-300 hover:text-white',
    );
  });

  it('renders label correctly', () => {
    const label = wordCloudItemLabel({ word: 'test', count: 5 });
    expect(label).toBe('test (5)');
  });
});

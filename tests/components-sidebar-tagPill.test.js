import { describe, it, expect } from 'vitest';
import {
  sidebarTagCloudEmptyStateHtml,
  sidebarTagPillClass,
  sidebarTagPillLabel,
} from '../src/components/sidebar/tagPill.js';

/**
 * Tests for the pure tag helpers extracted from src/views/sidebar.js.
 * They mirror the parity guards the monolith asserted in
 * tests/views-sidebar.test.js (exact placeholder, pill classes and labels).
 */

describe('sidebar tag helpers', () => {
  it('exports the empty placeholder identical to the monolith', () => {
    expect(sidebarTagCloudEmptyStateHtml()).toBe(
      '<span class="text-xs text-slate-500 italic">尚無標籤</span>',
    );
  });

  it('exports the selected/unselected pill classes', () => {
    expect(sidebarTagPillClass(true)).toBe(
      'text-[11px] px-2 py-0.5 rounded-full border transition bg-indigo-600 text-white border-indigo-400 font-semibold',
    );
    expect(sidebarTagPillClass(false)).toBe(
      'text-[11px] px-2 py-0.5 rounded-full border transition bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700',
    );
  });

  it('renders the tag-pill label', () => {
    expect(sidebarTagPillLabel({ tag: 'tech', count: 2 })).toBe('#tech (2)');
  });
});
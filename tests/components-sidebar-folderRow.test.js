import { describe, it, expect } from 'vitest';
import {
  sidebarAllFolderBtnClass,
  sidebarFolderItemClass,
  sidebarFolderBadgeColorClass,
  sidebarFolderItemHtml,
} from '../src/components/sidebar/folderRow.js';

/**
 * Tests for the pure folder-row helpers extracted from src/views/sidebar.js.
 * They mirror the parity guards the monolith asserted in
 * tests/views-sidebar.test.js (exact button classes, badge colours and row
 * markup).
 */

describe('sidebar folder helpers', () => {
  it('exports the active/inactive all-files button classes', () => {
    expect(sidebarAllFolderBtnClass(true)).toBe(
      'folder-btn active w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between bg-indigo-600/20 text-indigo-300 border border-indigo-500/30',
    );
    expect(sidebarAllFolderBtnClass(false)).toBe(
      'folder-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between text-slate-300 border border-transparent hover:bg-slate-700/50',
    );
  });

  it('exports the dynamic file-button classes', () => {
    expect(sidebarFolderItemClass(true)).toBe(
      'dynamic-file-btn folder-btn w-full group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer bg-indigo-600/20 text-indigo-300 border-indigo-500/30',
    );
    expect(sidebarFolderItemClass(false)).toBe(
      'dynamic-file-btn folder-btn w-full group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer text-slate-300 border-transparent hover:bg-slate-700/50',
    );
  });

  it('maps file types to their badge colours', () => {
    expect(sidebarFolderBadgeColorClass('csv')).toBe('bg-amber-900/60 text-amber-200');
    expect(sidebarFolderBadgeColorClass('json')).toBe('bg-emerald-900/60 text-emerald-200');
    expect(sidebarFolderBadgeColorClass('db')).toBe('bg-sky-900/60 text-sky-200');
  });

  it('renders the file name, badge, count and delete button', () => {
    const file = { id: 'f1', name: 'Export.csv', type: 'csv' };
    const html = sidebarFolderItemHtml({ file, count: 2 });
    expect(html).toContain('>Export.csv</span>');
    expect(html).toContain('bg-amber-900/60 text-amber-200');
    expect(html).toContain('shrink-0">csv</span>');
    expect(html).toContain('rounded">2</span>');
    expect(html).toContain('data-delete-folder');
    expect(html).toContain('title="刪除檔案與其書籤"');
  });
});
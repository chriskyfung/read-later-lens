import { describe, it, expect } from 'vitest';
import {
  formatDeletedAt,
  trashItemClass,
  trashItemHtml,
  trashModalHtml,
} from '../src/components/bookmarks/trash/index.js';

/**
 * Tests for the pure trash-modal markup helpers. They are the parity guards for
 * the trash view (src/views/trash.js), which only does DOM orchestration.
 */
describe('trash modal helpers', () => {
  it('exposes the modal shell anchors and the empty state', () => {
    const html = trashModalHtml();

    expect(html).toContain('id="trashModal"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="trashTitle"');
    expect(html).toContain('id="trashTitle"');
    expect(html).toContain('id="closeTrashBtn"');
    expect(html).toContain('id="trashSummary"');
    expect(html).toContain('id="emptyTrashBtn"');
    expect(html).toContain('id="trashList"');
    expect(html).toContain('id="trashEmptyState"');
    expect(html).toContain('清空回收桶');
    expect(html).toContain('回收桶是空的');
    // The modal ships hidden; openTrashModal() pushes it onto the layer stack.
    expect(html).toContain('id="trashModal" class="hidden');
    // Reader-width shell so the two row actions fit on mobile.
    const idx = html.indexOf('id="trashModal"');
    expect(html.slice(idx, idx + 500)).toContain('max-w-3xl');
  });

  it('exposes the trash row class', () => {
    expect(trashItemClass()).toBe(
      'bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-xl p-4 flex items-center justify-between gap-3 transition',
    );
  });

  it('renders title, preview, source file, deleted date and both actions', () => {
    const html = trashItemHtml({
      id: '1',
      title: 'Apple',
      article_preview: 'a preview',
      source_file_name: 'instapaper.csv',
      deleted_at: '2026-02-01T00:00:00.000Z',
    });

    expect(html).toContain('Apple');
    expect(html).toContain('a preview');
    expect(html).toContain('instapaper.csv');
    expect(html).toContain('刪除於');
    expect(html).toContain('還原');
    expect(html).toContain('永久刪除');
    expect(html).not.toContain('data-delete-bookmark');
    // The delegated listeners read the bookmark id from the attribute VALUE:
    // a bare boolean attribute reads back as '' in a real DOM, which made both
    // row actions no-ops after the modal migration.
    expect(html).toContain('data-restore-bookmark="1"');
    expect(html).toContain('data-purge-bookmark="1"');
  });

  it('escapes the snapshot fields and falls back for missing ones', () => {
    const html = trashItemHtml({ id: '1', title: '<img src=x>', tags: [] });

    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('無預覽內容');
    expect(html).toContain('未知');
  });

  it('escapes a hostile id before it reaches the action attributes', () => {
    const html = trashItemHtml({ id: '"><b>', title: 'T' });

    expect(html).toContain('data-restore-bookmark="&quot;&gt;&lt;b&gt;"');
    expect(html).not.toContain('"><b>');
  });

  it('formats the deleted timestamp defensively', () => {
    expect(formatDeletedAt('2026-02-01T00:00:00.000Z')).toContain('2026');
    expect(formatDeletedAt(null)).toBe('未知時間');
    expect(formatDeletedAt('not-a-date')).toBe('not-a-date');
  });
});

import { describe, it, expect } from 'vitest';
import {
  formatDeletedAt,
  trashItemClass,
  trashItemHtml,
  trashPanelHtml,
} from '../src/components/bookmarks/trashPanel.js';

/**
 * Tests for the pure trash-panel markup helpers. They are the parity guards for
 * the trash view (src/views/trash.js), which only does DOM orchestration and
 * dataset wiring.
 */
describe('trash panel helpers', () => {
  it('exposes the panel anchors and the empty state', () => {
    const html = trashPanelHtml();

    expect(html).toContain('id="trashPanel"');
    expect(html).toContain('id="trashSummary"');
    expect(html).toContain('id="emptyTrashBtn"');
    expect(html).toContain('id="trashList"');
    expect(html).toContain('id="trashEmptyState"');
    expect(html).toContain('清空回收桶');
    expect(html).toContain('回收桶是空的');
    // The panel ships hidden; the trash folder selection reveals it.
    expect(html).toContain('id="trashPanel" class="hidden"');
  });

  it('exposes the trash row class', () => {
    expect(trashItemClass()).toBe(
      'bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between gap-3 transition',
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
    expect(html).toContain('data-restore-bookmark');
    expect(html).toContain('data-purge-bookmark');
    expect(html).toContain('還原');
    expect(html).toContain('永久刪除');
    expect(html).not.toContain('data-delete-bookmark');
  });

  it('escapes the snapshot fields and falls back for missing ones', () => {
    const html = trashItemHtml({ id: '1', title: '<img src=x>', tags: [] });

    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('無預覽內容');
    expect(html).toContain('未知');
  });

  it('formats the deleted timestamp defensively', () => {
    expect(formatDeletedAt('2026-02-01T00:00:00.000Z')).toContain('2026');
    expect(formatDeletedAt(null)).toBe('未知時間');
    expect(formatDeletedAt('not-a-date')).toBe('not-a-date');
  });
});

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mountModals } from '../src/components/modals.js';

// ---- DOM stubs -----------------------------------------------------------
// mountModals appends overlay markup to document.body via insertAdjacentHTML.
const captured = [];

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  globalThis.document = {
    body: {
      insertAdjacentHTML: (position, html) => {
        expect(position).toBe('beforeend');
        captured.push(html);
      },
    },
    getElementById: () => null,
    createElement: () => ({ innerHTML: '', className: '' }),
  };
});

beforeEach(() => {
  captured.length = 0;
  mountModals();
});

const allHtml = () => captured.join('');

describe('mountModals — overlay markup parity', () => {
  it('mounts exactly one overlay block set, in monolith order', () => {
    expect(captured).toHaveLength(1);
    const html = allHtml();
    const order = [
      'readerModal',
      'similarityModal',
      'saveModal',
      'duplicateModal',
      'toastNotification',
    ];
    const positions = order.map((id) => html.indexOf(`id="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('keeps the reader modal ids, overlay classes and zh-TW labels', () => {
    const html = allHtml();
    expect(html).toContain('id="readerModal"');
    expect(html).toContain('id="readerLangBadge"');
    expect(html).toContain('id="readerTitle"');
    expect(html).toContain('id="readerOriginalUrl"');
    expect(html).toContain('id="readerPreviewContent"');
    expect(html).toContain('id="readerInstapaperBtn"');
    expect(html).toContain('id="closeReaderBtn"');
    expect(html).toContain('文章內文預覽');
    expect(html).toContain('開啟 Instapaper 閱讀器');
    // Phase 2 reader action buttons (🗑️ 刪除 / ⚡ 相似)
    expect(html).toContain('id="readerDeleteBtn"');
    expect(html).toContain('id="readerSimilarityBtn"');
    expect(html).toContain('title="刪除此書籤"');
    expect(html).toContain('title="查看相似文章"');
    expect(html).toContain('hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm');
    expect(html).toContain('d="M6 18L18 6M6 6l12 12"'); // close icon path
  });

  it('keeps the similarity modal ids and zh-TW labels', () => {
    const html = allHtml();
    expect(html).toContain('id="similarityModal"');
    expect(html).toContain('id="closeSimilarityBtn"');
    expect(html).toContain('id="simTargetTitle"');
    expect(html).toContain('id="simResultsList"');
    expect(html).toContain('⚡ 相似文章推薦分析 (Cosine Similarity)');
    expect(html).toContain('目標文章:');
    expect(html).toContain('關聯度最高的文章列表：');
    expect(html).toContain('max-h-[85vh]');
  });

  it('keeps the save/export modal ids, buttons and zh-TW labels', () => {
    const html = allHtml();
    expect(html).toContain('id="saveModal"');
    expect(html).toContain('id="closeSaveBtn"');
    expect(html).toContain('id="saveSourceFilesList"');
    expect(html).toContain('id="exportAllUnifiedJsonBtn"');
    expect(html).toContain('id="exportAllUnifiedCsvBtn"');
    expect(html).toContain('💾 儲存與匯出變更');
    expect(html).toContain('匯出成統一 JSON');
    expect(html).toContain('匯出成統一');
    expect(html).toContain('CSV');
  });

  it('keeps the duplicate-warning modal ids, buttons and zh-TW labels', () => {
    const html = allHtml();
    expect(html).toContain('id="duplicateModal"');
    expect(html).toContain('id="duplicateFileText"');
    expect(html).toContain('id="dupBtnOverwrite"');
    expect(html).toContain('id="dupBtnKeepBoth"');
    expect(html).toContain('id="dupBtnCancel"');
    expect(html).toContain('發現同名檔案');
    expect(html).toContain('覆寫舊檔案');
    expect(html).toContain('兩者皆保留');
    expect(html).toContain('取消匯入');
  });

  it('keeps the toast markup', () => {
    const html = allHtml();
    expect(html).toContain('id="toastNotification"');
    expect(html).toContain('id="toastMsg"');
    expect(html).toContain('通知訊息');
    expect(html).toContain('translate-y-20 opacity-0');
  });

  it('marks each dialog with role, aria-modal, tabindex and a labelled heading', () => {
    const html = allHtml();
    for (const [id, label] of [
      ['readerModal', 'readerTitle'],
      ['similarityModal', 'similarityTitle'],
      ['saveModal', 'saveTitle'],
    ]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(
        `role="dialog" aria-modal="true" aria-labelledby="${label}" tabindex="-1"`,
      );
    }
    // Labelled headings live on the existing <h3> titles.
    expect(html).toContain('id="similarityTitle"');
    expect(html).toContain('id="saveTitle"');
  });

  it('starts every overlay hidden (Tailwind hidden class on the fixed containers)', () => {
    const html = allHtml();
    for (const id of ['readerModal', 'similarityModal', 'saveModal', 'duplicateModal']) {
      const idx = html.indexOf(`id="${id}"`);
      expect(html.slice(idx - 40, idx + 120)).toContain('class="hidden');
    }
  });
});

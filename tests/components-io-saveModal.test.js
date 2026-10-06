import { describe, it, expect } from 'vitest';
import { saveModalHtml, saveSourceFileRowHtml } from '../src/components/io/saveModal.js';

/**
 * The save/export modal's source rows are assigned to innerHTML by
 * renderSaveModal() (src/io/exporter.js), so file.name — whatever the OS handed
 * the picker, replayed from the IndexedDB cache on later visits — has to arrive
 * as text, not as markup.
 */

const HOSTILE_NAME = '"><img src=x onerror=alert(1)>.csv';

describe('saveModalHtml', () => {
  it('keeps the static shell, file list and export buttons', () => {
    const html = saveModalHtml();
    expect(html).toContain('id="saveModal"');
    expect(html).toContain('id="saveSourceFilesList"');
    expect(html).toContain('id="exportAllUnifiedJsonBtn"');
    expect(html).toContain('id="exportAllUnifiedCsvBtn"');
  });

  it('describes save-back as Save-As with a download fallback, never an in-place write', () => {
    const html = saveModalHtml();

    // The flow save-back actually implements. Promising a direct write would
    // be untrue in Firefox/Safari, which have no showSaveFilePicker.
    expect(html).toContain('另存新檔');
    expect(html).toContain('其餘瀏覽器將直接下載');
    expect(html).not.toContain('直接寫入');
    expect(html).not.toContain('File System Access');
  });
});

describe('saveSourceFileRowHtml', () => {
  it('renders the name, type label and save button for a benign file', () => {
    const html = saveSourceFileRowHtml({ file: { id: 'F1', name: 'a.csv', type: 'csv' } });

    expect(html).toContain('>a.csv</div>');
    expect(html).toContain('>csv 格式</div>');
    expect(html).toContain('data-save-file');
    expect(html).toContain('儲存/下載');
  });

  it('escapes a hostile source name instead of emitting markup', () => {
    const html = saveSourceFileRowHtml({ file: { id: 'F1', name: HOSTILE_NAME, type: 'csv' } });

    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;.csv');
    expect(html).not.toContain('<img');
  });

  it('escapes a hostile type as well', () => {
    const html = saveSourceFileRowHtml({ file: { id: 'F1', name: 'a.csv', type: '<b>evil</b>' } });

    expect(html).toContain('&lt;b&gt;evil&lt;/b&gt; 格式');
    expect(html).not.toContain('<b>');
  });
});

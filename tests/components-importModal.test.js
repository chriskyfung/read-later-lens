import { describe, it, expect } from 'vitest';
import {
  importModalHtml,
  SELECTED_CARD_CLASSES,
  UNSELECTED_CARD_CLASSES,
} from '../src/components/io/importModal.js';

const html = () => importModalHtml();

describe('importModalHtml — markup parity', () => {
  it('renders the modal with dialog a11y attributes and a labelled heading', () => {
    expect(html()).toContain('id="importModal"');
    expect(html()).toContain(
      'role="dialog" aria-modal="true" aria-labelledby="importTitle" tabindex="-1"',
    );
    expect(html()).toContain('id="importTitle"');
    expect(html()).toContain('📥 選擇匯入來源');
    expect(html()).toContain('class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm');
  });

  it('renders a radiogroup with one radio card per selectable profile', () => {
    expect(html()).toContain('id="importSourceGroup"');
    expect(html()).toContain('role="radiogroup"');
    expect(html()).toContain('aria-labelledby="importTitle"');
    expect(html()).toContain('id="importProfile-instapaper-scraper"');
    expect(html()).toContain('id="importProfile-rll-unified"');
    expect(html()).toMatch(/role="radio"/g); // present at all
    // The default profile is pre-checked, the unified profile is not.
    expect(html()).toContain(
      'role="radio" aria-checked="true" id="importProfile-instapaper-scraper"',
    );
    expect(html()).toContain('role="radio" aria-checked="false" id="importProfile-rll-unified"');
  });

  it('pre-selects the InstapaperScraper card with the selected border classes', () => {
    const scraperCard = html().split('id="importProfile-instapaper-scraper"')[1];
    for (const cls of SELECTED_CARD_CLASSES) expect(scraperCard).toContain(cls);
    const unifiedCard = html().split('id="importProfile-rll-unified"')[1];
    for (const cls of UNSELECTED_CARD_CLASSES.slice(0, 3)) expect(unifiedCard).toContain(cls);
  });

  it('keeps the zh-TW labels, format hints and the disabled roadmap card', () => {
    expect(html()).toContain('InstapaperScraper 匯出');
    expect(html()).toContain('Read Later Lens 統一匯出');
    expect(html()).toContain('CSV / JSON / SQLite');
    expect(html()).toContain('更多資料來源即將推出');
    expect(html()).toContain('<button type="button" disabled');
    // Exactly the two selectable profiles are radios; the disabled roadmap
    // card sits outside the radiogroup and must not pretend to be one.
    expect(html().match(/role="radio"/g)).toHaveLength(2);
    const roadmapBlock = html().split('<button type="button" disabled')[1] ?? '';
    expect(roadmapBlock.split('</button>')[0]).not.toContain('role="radio"');
  });

  it('documents why the official Instapaper CSV is not offered', () => {
    expect(html()).toContain('官方 Instapaper CSV');
    expect(html()).toContain('僅含連結、無預覽內容');
    expect(html()).toContain('InstapaperScraper');
  });

  it('keeps close, cancel and pick-file controls', () => {
    expect(html()).toContain('id="closeImportBtn"');
    expect(html()).toContain('id="importCancelBtn"');
    expect(html()).toContain('id="importPickFileBtn"');
    expect(html()).toContain('取消');
    expect(html()).toContain('選擇檔案…');
    // The close glyph matches every other modal.
    expect(html()).toContain('d="M6 18L18 6M6 6l12 12"');
  });
});

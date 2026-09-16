import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderAll } from '../src/views/main-view.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// main.js publishes the module bridge that index.html's classic script consumes.
beforeAll(async () => {
  globalThis.window = globalThis.window || {};
  await import('../src/main.js');
});

describe('main.js bridge (window.IBM)', () => {
  it('publishes the actual module-owned renderAll function', () => {
    expect(globalThis.window.IBM.renderAll).toBe(renderAll);
  });

  it('keeps the inline delegate without restoring the reverse bridge or duplicate renderers', () => {
    expect(html).toMatch(/function renderAll\(\)\s*\{\s*return window\.IBM\.renderAll\(\);\s*\}/);
    expect(html).not.toMatch(/window\.IBM\.renderAll\s*=/);
    expect(html).not.toMatch(/function (renderSidebarFolders|renderTagCloud)\s*\(/);
    expect(html).toMatch(/function selectFolder\(/);
    expect(html).toMatch(/function confirmDeleteFolder\(/);
  });

  it('exposes every dependency the inline script uses', () => {
    const ibm = globalThis.window.IBM;
    expect(ibm).toBeTruthy();
    for (const key of [
      'state',
      'getFilteredBookmarks',
      'getFilteredBookmarksTop',
      'saveState',
      'loadState',
      'getStorageUsage',
      'normalizeFields',
      'normalizeTags',
      'makeReaderUrl',
      'escapeHtml',
      'showToast',
      'downloadBlob',
      'saveFileWithFallback',
      'importJsonOrCsv',
      'importSqlite',
      'providerForExtension',
      'detectLanguage',
      'wordCloudFrequencies',
      'wordCloudItems',
      'topDomains',
      'cosineSimilarity',
      'mostSimilar',
      'openReaderModal',
      'closeReaderModal',
      'openSimilarityModal',
      'closeSimilarityModal',
      'renderBookmarkCards',
      'toggleSelectBookmark',
      'updateBatchActionBar',
      'activateTab',
      'renderWordCloud',
      'renderDomainChart',
      'renderConceptLinkageGraph',
      'zoomGraphBy',
      'resetGraphZoom',
      'renderAll',
    ]) {
      expect(ibm[key], key).toBeDefined();
    }
  });

  it('exposes the state facade setters used by index.html', () => {
    const { state } = globalThis.window.IBM;
    for (const fn of [
      'setBookmarks',
      'setSourceFiles',
      'setActiveFolder',
      'setActiveLang',
      'setActiveTag',
      'setActiveTab',
      'setSearchQuery',
      'setSortBy',
      'setSelectedIds',
      'setSQL',
    ]) {
      expect(typeof state[fn], fn).toBe('function');
    }
  });
});

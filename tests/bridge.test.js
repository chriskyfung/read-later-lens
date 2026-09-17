import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderAll } from '../src/views/main-view.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

let _bodyHtml = '';

// main.js publishes the module bridge that index.html's classic script consumes.
// registerImporterListeners / registerExporterListeners run at module import
// time, so DOM stubs must exist before main.js is imported.
beforeAll(async () => {
  const els = {};
  const makeEl = () => ({
    innerText: '',
    innerHTML: '',
    className: '',
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    appendChild: vi.fn(),
    onclick: null,
  });

  globalThis.window = globalThis.window || {};
  globalThis.document = {
    getElementById: (id) => (els[id] = els[id] || makeEl()),
    createElement: () => makeEl(),
    // main.js calls mountModals() at import time; we don't parse HTML here.
    body: { insertAdjacentHTML: (position, html) => { _bodyHtml += html; } },
  };

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
      'handleFileUploads',
      'openSaveModal',
      'saveSingleFile',
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

  it('contains no remaining monolith-style I/O handlers in HTML', () => {
    expect(html).not.toMatch(/function openSaveModal\(/);
    expect(html).not.toMatch(/async function saveSingleFile\(/);
    expect(html).not.toMatch(/function saveFileWithFallback\(/);
    expect(html).not.toMatch(/function downloadBlob\(/);
    expect(html).not.toMatch(/async function handleFileUploads\(/);
    expect(html).not.toMatch(/function acceptRecords\(/);
    expect(html).not.toMatch(/Papa\.parse\(/);
    expect(html).not.toMatch(/initSql\(/);
  });

  it('contains no remaining modal markup or delegates (moved to src/components)', () => {
    for (const id of [
      'readerModal',
      'similarityModal',
      'saveModal',
      'duplicateModal',
      'toastNotification',
    ]) {
      expect(html, id).not.toContain(`id="${id}"`);
    }
    expect(html).not.toMatch(/function (openReaderModal|closeReaderModal|openSimilarityModal|closeSimilarityModal)\(/);
    expect(html).not.toContain('MODAL 1: Reader View Modal');
  });

  it('retains no header markup (moved to src/components/header.js)', () => {
    expect(html).not.toMatch(/<header/);
    expect(html).not.toContain('id="searchInput"');
    expect(html).not.toContain('id="clearCacheBtn"');
    expect(html).not.toContain('id="fileInput"');
    expect(html).not.toContain('id="saveBackBtn"');
    // Header handlers also moved (no double registration).
    expect(html).not.toMatch(/clearCacheBtn'\)\.onclick/);
    expect(html).not.toMatch(/searchInput'\)\.addEventListener/);
  });
});

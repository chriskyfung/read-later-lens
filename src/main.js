import './styles/main.css';

import * as state from './core/state.js';
import { getFilteredBookmarks, getFilteredBookmarksTop } from './core/filters.js';
import { saveState, loadState, getStorageUsage } from './core/store.js';
import { normalizeFields, normalizeTags } from './model/normalize.js';
import { makeReaderUrl } from './model/BookmarkRecord.js';
import { escapeHtml, showToast } from './utils/dom.js';
import { downloadBlob, saveFileWithFallback } from './utils/download.js';
import { importJsonOrCsv, importSqlite, providerForExtension } from './providers/index.js';
import { detectLanguage } from './analytics/detectLanguage.js';
import { wordCloudFrequencies, wordCloudItems } from './analytics/wordcloud.js';
import { topDomains } from './analytics/domains.js';
import { cosineSimilarity, mostSimilar } from './analytics/similarity.js';
import { openReaderModal, closeReaderModal } from './views/readerModal.js';
import { openSimilarityModal, closeSimilarityModal } from './views/similarityModal.js';
import {
  renderBookmarkCards,
  toggleSelectBookmark,
  updateBatchActionBar,
} from './views/bookmarks.js';
import { activateTab } from './views/tabs.js';
import { renderDomainChart } from './views/domains.js';
import { renderConceptLinkageGraph, zoomGraphBy, resetGraphZoom } from './views/linkage.js';
import { renderWordCloud } from './views/wordcloud.js';
import { renderAll } from './views/main-view.js';

import { initImporter, registerImporterListeners, handleFileUploads } from './io/importer.js';
import { registerExporterListeners, openSaveModal, saveSingleFile } from './io/exporter.js';
import { mountHeader } from './components/header.js';
import { mountModals } from './components/modals.js';
import { initHeader, registerHeaderListeners } from './views/header.js';
import { registerModalListeners } from './views/modalListeners.js';

// Bridge for the legacy inline <script> in index.html while the monolith is
// being decomposed. Module scripts execute after HTML parsing but before
// DOMContentLoaded, so every runtime handler in index.html sees window.IBM.
window.IBM = {
  state,
  getFilteredBookmarks,
  getFilteredBookmarksTop,
  saveState,
  loadState,
  getStorageUsage,
  normalizeFields,
  normalizeTags,
  makeReaderUrl,
  escapeHtml,
  showToast,
  downloadBlob,
  saveFileWithFallback,
  importJsonOrCsv,
  importSqlite,
  providerForExtension,
  detectLanguage,
  wordCloudFrequencies,
  wordCloudItems,
  topDomains,
  cosineSimilarity,
  mostSimilar,
  openReaderModal,
  closeReaderModal,
  openSimilarityModal,
  closeSimilarityModal,
  renderBookmarkCards,
  toggleSelectBookmark,
  updateBatchActionBar,
  activateTab,
  renderWordCloud,
  renderDomainChart,
  renderConceptLinkageGraph,
  zoomGraphBy,
  resetGraphZoom,
  renderAll,
  // Added for I/O extraction
  handleFileUploads,
  openSaveModal,
  saveSingleFile,
};

// Helper for I/O modules to trigger persistence and UI updates
async function persistAndRender() {
  await saveState();
  if (window.IBM.updateStorageUsageUI) {
    await window.IBM.updateStorageUsageUI();
  }
  renderAll();
}

// Initialize I/O modules
initImporter({
  persistAndRender: persistAndRender,
  deleteFolder: (fileId, triggerRender = true) => {
    state.removeSourceFile(fileId);
    // Mirrors the original monolith's deleteFolder side-effects
    saveState();
    if (window.IBM.updateStorageUsageUI) {
      window.IBM.updateStorageUsageUI();
    }
    if (triggerRender) {
      renderAll();
      showToast('已成功刪除檔案及其書籤');
    }
  }
});

// Mount overlay markup (header + modals + toast), then register listeners.
// Order matters: every register* call targets elements created by the mounts.
mountHeader();
mountModals();
initHeader({ render: renderAll, persistAndRender });
registerHeaderListeners();
registerModalListeners();
registerImporterListeners();
registerExporterListeners();


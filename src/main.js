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
import { mountSidebar } from './components/sidebar.js';
import { mountModals } from './components/modals.js';
import { initHeader, registerHeaderListeners } from './views/header.js';
import {
  initSidebarActions,
  registerSidebarListeners,
  selectFolder,
  confirmDeleteFolder,
  deleteFolder,
  updateStorageUsageUI,
} from './views/sidebarActions.js';
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
  // Sidebar actions (called from generated row onclick in views/sidebar.js)
  selectFolder,
  confirmDeleteFolder,
  deleteFolder,
  updateStorageUsageUI,
};

// Helper for I/O modules to trigger persistence and UI updates
async function persistAndRender() {
  await saveState();
  await updateStorageUsageUI();
  renderAll();
}

// Initialize I/O modules — the importer's overwrite flow reuses the same
// module-owned deleteFolder as the sidebar (monolith used the same function).
initImporter({
  persistAndRender: persistAndRender,
  deleteFolder: deleteFolder,
});

// Mount overlay markup (header + sidebar + modals + toast), then register
// listeners. Order matters: every register* call targets elements created
// by the mounts.
mountHeader();
mountSidebar();
mountModals();
initHeader({ render: renderAll, persistAndRender });
initSidebarActions({
  persist: async () => {
    await saveState();
    await updateStorageUsageUI();
  },
  render: renderAll,
});
registerHeaderListeners();
registerSidebarListeners();
registerModalListeners();
registerImporterListeners();
registerExporterListeners();


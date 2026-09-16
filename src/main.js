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
};

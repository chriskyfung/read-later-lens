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
};

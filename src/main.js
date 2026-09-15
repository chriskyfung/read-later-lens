import './styles/main.css';

import * as state from './core/state.js';
import { getFilteredBookmarks, getFilteredBookmarksTop } from './core/filters.js';
import { saveState, loadState, getStorageUsage } from './core/store.js';
import { normalizeFields, normalizeTags } from './model/normalize.js';
import { makeReaderUrl } from './model/BookmarkRecord.js';

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
};

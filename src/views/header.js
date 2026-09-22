/**
 * @fileoverview Header behavior — search input and clear-cache flows.
 *
 * Extracted from the monolith's DOMContentLoaded block in index.html.
 * Must be called AFTER mountHeader() (src/components/header.js) so the
 * header elements exist. Listeners for #fileInput and #saveBackBtn remain
 * owned by src/io/importer.js and src/io/exporter.js respectively.
 */

import * as state from '../core/state.js';
import { showToast } from '../utils/dom.js';

/** @typedef {object} HeaderDeps
 * @property {function} render - Re-render all views (search does NOT persist, monolith parity).
 * @property {function} persistAndRender - Save state to IndexedDB and re-render views.
 */
let deps = { render: () => {}, persistAndRender: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initImporter).
 * @param {HeaderDeps} injectedDeps
 */
export function initHeader(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Attach the search-input and clear-cache handlers.
 */
export function registerHeaderListeners() {
  // Search input — monolith parity: sets the query and re-renders only
  // (no IndexedDB write on every keystroke).
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    state.setSearchQuery(e.target.value);
    deps.render();
  });

  // Clear cache button
  document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
    if (confirm('確定要清除 IndexedDB 中的本地快取書籤資料嗎？')) {
      const icon = document.getElementById('clearCacheIcon');
      icon.classList.add('animate-spin');

      setTimeout(() => {
        state.setBookmarks([]);
        state.sourceFiles.clear(); // in-place clear (monolith parity)
        deps.persistAndRender();
        icon.classList.remove('animate-spin');
        showToast('已成功清空本地快取');
      }, 400);
    }
  });
}

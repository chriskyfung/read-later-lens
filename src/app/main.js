/**
 * @fileoverview Application boot sequence — mount UI, wire listeners, restore
 * persisted state, render. Thin orchestrator: all persistence logic lives in
 * ./persist.js, all view rendering in ../views/main-view.js.
 */
import '../styles/main.css';

import * as state from '../core/state';
import { loadState } from '../core/store';
import { showToast } from '../utils/dom';
import { initDomains } from '../views/domains.js';
import { initWordCloud } from '../views/wordcloud.js';
import { renderAll } from '../views/main-view.js';

import { initImporter, registerImporterListeners } from '../io/import';
import { registerExporterListeners } from '../io/export';
import { mountHeader } from '../components/header';
import { mountSidebar } from '../components/sidebar/panel.js';
import { mountWorkspace } from '../components/workspace';
import { mountModals } from '../components/modals.js';
import { initHeader, registerHeaderListeners } from '../views/header';
import {
  initSidebarActions,
  registerSidebarListeners,
  updateStorageUsageUI,
} from '../views/sidebar';
import { initWorkspaceActions, registerWorkspaceListeners } from '../views/workspace';
import { registerModalListeners } from '../views/modalListeners.js';
import { initTrash, registerTrashListeners } from '../views/trash';
import { persistAndRender, persistAfterAction } from './persist.js';

// Boot sequence — mount UI, wire listeners, restore persisted state, render.
async function boot() {
  mountHeader();
  mountSidebar();
  mountWorkspace();
  mountModals();
  initHeader({ render: renderAll, persistAndRender });
  initSidebarActions({
    persist: persistAfterAction,
    render: renderAll,
  });
  initWordCloud({ render: renderAll });
  initDomains({ render: renderAll });
  initImporter({ persistAndRender, render: renderAll });
  initWorkspaceActions({
    persist: persistAfterAction,
    render: renderAll,
  });
  initTrash({
    persist: persistAfterAction,
    render: renderAll,
  });
  registerHeaderListeners();
  registerSidebarListeners();
  registerWorkspaceListeners();
  registerTrashListeners();
  registerModalListeners();
  registerImporterListeners();
  registerExporterListeners();

  // Restore cached state, then render the live UI.
  try {
    const restored = await loadState();
    if (restored) {
      showToast(`已成功從 IndexedDB 快取復原 ${state.bookmarks.length} 筆書籤`);
    }
  } catch (err) {
    console.error('Cache restoration failed:', err);
  }
  try {
    await updateStorageUsageUI();
  } catch (err) {
    console.error('Storage usage update failed:', err);
  }
  renderAll();
}

export const ready = boot();

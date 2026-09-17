import './styles/main.css';

import * as state from './core/state.js';
import { saveState, loadState } from './core/store.js';
import { showToast } from './utils/dom.js';
import { initDomains } from './views/domains.js';
import { initWordCloud } from './views/wordcloud.js';
import { renderAll } from './views/main-view.js';

import { initImporter, registerImporterListeners } from './io/importer.js';
import { registerExporterListeners } from './io/exporter.js';
import { mountHeader } from './components/header.js';
import { mountSidebar } from './components/sidebar.js';
import { mountWorkspace } from './components/workspace.js';
import { mountModals } from './components/modals.js';
import { initHeader, registerHeaderListeners } from './views/header.js';
import {
  initSidebarActions,
  registerSidebarListeners,
  deleteFolder,
  updateStorageUsageUI,
} from './views/sidebarActions.js';
import {
  initWorkspaceActions,
  registerWorkspaceListeners,
} from './views/workspaceActions.js';
import { registerModalListeners } from './views/modalListeners.js';

// Helper for I/O modules to trigger persistence and UI updates
async function persistAndRender() {
  await saveState();
  await updateStorageUsageUI();
  renderAll();
}

// Boot sequence — mount UI, wire listeners, restore persisted state, render.
async function boot() {
  mountHeader();
  mountSidebar();
  mountWorkspace();
  mountModals();
  initHeader({ render: renderAll, persistAndRender });
  initSidebarActions({
    persist: async () => {
      await saveState();
      await updateStorageUsageUI();
    },
    render: renderAll,
  });
  initWordCloud({ render: renderAll });
  initDomains({ render: renderAll });
  initImporter({ persistAndRender, deleteFolder });
  initWorkspaceActions({
    persist: async () => {
      await saveState();
      await updateStorageUsageUI();
    },
    render: renderAll,
  });
  registerHeaderListeners();
  registerSidebarListeners();
  registerWorkspaceListeners();
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

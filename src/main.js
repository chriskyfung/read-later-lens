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
import { mountSidebar } from './components/sidebar/panel.js';
import { mountWorkspace } from './components/workspace.js';
import { mountModals } from './components/modals.js';
import { initHeader, registerHeaderListeners } from './views/header.js';
import {
  initSidebarActions,
  registerSidebarListeners,
  deleteFolder,
  updateStorageUsageUI,
} from './views/sidebarActions.js';
import { initWorkspaceActions, registerWorkspaceListeners } from './views/workspaceActions.js';
import { registerModalListeners } from './views/modalListeners.js';
import { initTrash, registerTrashListeners } from './views/trash.js';

/**
 * Helper for I/O modules to trigger persistence and UI updates.
 *
 * Never rejects and never short-circuits: each step is guarded on its own so a
 * broken step (quota error, render exception) cannot swallow the others or
 * escape as an unhandled rejection from a fire-and-forget caller. Callers that
 * care about the outcome read the returned status; callers that ignore the
 * promise keep working exactly as before.
 *
 * @returns {Promise<{persisted: boolean, rendered: boolean}>} `persisted` is
 *   false when the IndexedDB write failed (this session is not cached);
 *   `rendered` is false when the view refresh threw.
 */
async function persistAndRender() {
  let persisted = false;
  try {
    // saveState() now reports failure instead of swallowing it; a throwing
    // stub (or a future implementation) must be just as survivable.
    persisted = (await saveState()) !== false;
  } catch (err) {
    console.warn('IndexedDB save failed:', err);
  }

  // The storage meter is cosmetic — never let it mask the real status.
  try {
    await updateStorageUsageUI();
  } catch (err) {
    console.warn('Storage usage update failed:', err);
  }

  let rendered = false;
  try {
    renderAll();
    rendered = true;
  } catch (err) {
    console.warn('Render failed:', err);
  }

  return { persisted, rendered };
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
  initImporter({ persistAndRender, deleteFolder, render: renderAll });
  initWorkspaceActions({
    persist: async () => {
      await saveState();
      await updateStorageUsageUI();
    },
    render: renderAll,
  });
  initTrash({
    persist: async () => {
      await saveState();
      await updateStorageUsageUI();
    },
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

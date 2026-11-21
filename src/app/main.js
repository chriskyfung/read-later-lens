/**
 * @fileoverview Application boot sequence — mount UI, wire listeners, restore
 * persisted state, render. Thin orchestrator: all persistence logic lives in
 * ./persist.js, all view rendering in ./shell.js.
 */
import '../styles/main.css';

import * as state from '../core/state';
import { loadState } from '../core/persistence';
import { showToast } from '../utils/dom';
import { initDomains } from '@/features/domains';
import { initWordCloud } from '@/features/wordcloud';
import { renderAll } from './shell.js';

import { initImporter, registerImporterListeners } from '../io/import';
import { registerExporterListeners } from '../io/export';
import {
  mountHeader,
  initHeader as initHeaderBehavior,
  registerHeaderListeners,
} from '@/features/header';
import {
  mountSidebar,
  initSidebarActions,
  registerSidebarListeners,
  updateStorageUsageUI,
} from '@/features/sidebar';
import {
  mountWorkspace,
  initWorkspaceActions,
  registerWorkspaceListeners,
} from '@/features/workspace';
import { mountModals } from '../components/modals.js';
import { registerModalListeners } from './modalListeners.js';
import { initTrash, registerTrashListeners } from '@/features/trash';
import { persistAndRender, persistAfterAction } from './persist.js';

import {
  createIcons,
  CircleQuestionMark,
  GraphStar,
  ChartBarDecreasing,
  Letters,
  Orbit,
  ExternalLink,
  Trash,
  X,
  Heart,
  SquareBookmark,
  Search,
  FileInput,
  FileOutput,
  GalleryVerticalEnd,
  ZoomIn,
  ZoomOut,
  Info,
  TriangleExclamationPoint,
  BookOpen,
} from 'lucide';

// Boot sequence — mount UI, wire listeners, restore persisted state, render.
async function boot() {
  mountHeader();
  mountSidebar();
  mountWorkspace();
  mountModals();
  createIcons({
    icons: {
      CircleQuestionMark,
      GraphStar,
      ChartBarDecreasing,
      Letters,
      Orbit,
      ExternalLink,
      Trash,
      X,
      Heart,
      SquareBookmark,
      Search,
      FileInput,
      FileOutput,
      GalleryVerticalEnd,
      ZoomIn,
      ZoomOut,
      Info,
      TriangleExclamationPoint,
      BookOpen,
    },
  });
  initHeaderBehavior({ render: renderAll, persistAndRender });
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

  // Pre-warm the keyword engine during idle time so the word cloud tab opens
  // without waiting for the compromise chunk to download. Skipped silently in
  // environments without requestIdleCallback (tests, older browsers).
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
      import('@/analytics/engine.js').then(({ preloadEngine }) => preloadEngine());
    });
  }
}

export const ready = boot();

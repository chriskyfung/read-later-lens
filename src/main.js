import './styles/main.css';

import * as state from './core/state.js';
import { saveState, loadState } from './core/store.js';
import { STALE_STATE_MESSAGE } from './core/guard.js';
import { showToast } from './utils/dom.js';
import { initDomains } from './views/domains.js';
import { initWordCloud } from './views/wordcloud.js';
import { renderAll } from './views/main-view.js';

import { initImporter, registerImporterListeners } from './io/importer.js';
import { registerExporterListeners } from './io/exporter.js';
import { mountHeader } from './components/header';
import { mountSidebar } from './components/sidebar/panel.js';
import { mountWorkspace } from './components/workspace';
import { mountModals } from './components/modals.js';
import { initHeader, registerHeaderListeners } from './views/header';
import {
  initSidebarActions,
  registerSidebarListeners,
  updateStorageUsageUI,
} from './views/sidebar';
import { initWorkspaceActions, registerWorkspaceListeners } from './views/workspace';
import { registerModalListeners } from './views/modalListeners.js';
import { initTrash, registerTrashListeners } from './views/trash';

/**
 * Toast text when a post-action persist write fails for a reason OTHER than a
 * cross-tab conflict (e.g. quota, transaction abort): before this feature the
 * view's success toast stood alone, so a failed cache write quietly disagreed
 * with what the user saw. The conflict case keeps its own message.
 */
export const PERSIST_WRITE_FAILED_MESSAGE = '無法寫入本機快取，剛才的變更可能不會保留';

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
  let conflict = false;
  try {
    // saveState() now reports failure instead of swallowing it; a throwing
    // stub (or a future implementation) must be just as survivable. Both the
    // `{persisted, conflict}` object and the legacy `false`/void forms read as
    // "not persisted", so a stub that says nothing still counts as committed.
    const saved = await saveState();
    persisted = saved !== false && saved?.persisted !== false;
    conflict = saved?.conflict === true;
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

  return { persisted, rendered, conflict };
}

/**
 * Persist on behalf of an action that has already mutated `state` in memory.
 *
 * Each such action probes `isStateFresh()` first, so a *refused* save (`{…
 * conflict: true }`) means another tab won the race in that gap. The
 * in-memory change and its render have already happened, so the only honest
 * response left is to say so and ask for a reload — never to report quiet
 * success. A genuine storage failure is *also* reported: the base `saveState`
 * result (`persisted: false` without `conflict`) means this session is no
 * longer cached, and a reload would resurrect what the user just deleted.
 *
 * The outcome is RETURNED as well as announced, so an action that awaits this
 * call can decide not to stack a success message on top of a failure one
 * (the toast area shows one message at a time — the last call wins).
 *
 * @returns {Promise<{persisted: boolean, conflict: boolean}>} The write outcome.
 */
async function persistAfterAction() {
  let persisted = true;
  let conflict = false;
  try {
    const saved = await saveState();
    // A stub that says nothing counts as committed: `saved !== false` and
    // `saved?.persisted !== false` both mean "the save reported no failure".
    persisted = saved !== false && saved?.persisted !== false;
    conflict = saved?.conflict === true;
  } catch (err) {
    console.warn('IndexedDB save failed:', err);
    persisted = false;
  }

  if (!persisted && !conflict) {
    showToast(PERSIST_WRITE_FAILED_MESSAGE);
  } else if (conflict) {
    showToast(STALE_STATE_MESSAGE);
  }

  try {
    await updateStorageUsageUI();
  } catch (err) {
    console.warn('Storage usage update failed:', err);
  }

  return { persisted, conflict };
}

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

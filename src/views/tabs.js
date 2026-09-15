/**
 * @fileoverview Tab navigation — active-tab state + tab bar / panel visibility.
 *
 * Extracted from the monolith's `switchTab` (state transition, the exact
 * `.main-tab` class strings, `.tab-panel` show/hide). Content rendering for
 * the analytics tabs is invoked by the caller after the panel is visible,
 * matching the original execution order.
 */

import { setActiveTab } from '../core/state.js';

const ACTIVE_TAB_CLASS =
  'main-tab active px-3 py-1 rounded-md text-xs font-semibold text-white bg-indigo-600 shadow';
const INACTIVE_TAB_CLASS =
  'main-tab px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200';

const PANEL_IDS = {
  bookmarks: 'panelBookmarks',
  wordcloud: 'panelWordcloud',
  domains: 'panelDomains',
  linkage: 'panelLinkage',
};

/**
 * Activate a tab: update state, restyle the tab bar, toggle panel visibility.
 *
 * @param {string} tabId
 */
export function activateTab(tabId) {
  setActiveTab(tabId);

  document.querySelectorAll('.main-tab').forEach((b) => {
    b.className = b.dataset.tab === tabId ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS;
  });

  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));

  const panel = document.getElementById(PANEL_IDS[tabId]);
  if (panel) panel.classList.remove('hidden');
}

/**
 * @fileoverview Sidebar tag-cloud renderer.
 *
 * Extracted from src/views/sidebar.js `renderTagCloud()` when the sidebar
 * split into src/views/sidebar/*. The markup helpers stay pure in
 * src/components/sidebar/tagPill.js; this module owns DOM creation and the
 * `data-filter-tag` dataset wiring.
 */

import { activeTag } from '../../core/state';
import {
  sidebarTagCloudEmptyStateHtml,
  sidebarTagPillClass,
  sidebarTagPillLabel,
} from '../../components/sidebar/tagPill.js';
import { SIDEBAR_IDS } from './constants.js';
import { collectTagCounts } from './service.js';

/**
 * Render the tag cloud.
 */
export function renderTagCloud() {
  const container = document.getElementById(SIDEBAR_IDS.tagFilterCloud);
  if (!container) return;

  const tagsMap = collectTagCounts();

  if (tagsMap.size === 0) {
    container.innerHTML = sidebarTagCloudEmptyStateHtml();
    return;
  }

  container.innerHTML = '';
  tagsMap.forEach((cnt, tag) => {
    const isSelected = activeTag === tag;
    const pill = document.createElement('button');
    pill.className = sidebarTagPillClass(isSelected);
    pill.innerText = sidebarTagPillLabel({ tag, count: cnt });
    pill.dataset.filterTag = tag;
    container.appendChild(pill);
  });
}

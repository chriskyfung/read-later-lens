/**
 * @fileoverview Left sidebar — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html
 * "Left Sidebar"). Behavior mapping:
 *  - folder rows (dynamic)  → src/views/sidebar.js (renderer)
 *  - folder select/delete   → src/views/sidebarActions.js (delegated listeners)
 *  - allFolderBtn / languageFilters → src/views/sidebarActions.js
 *  - storage usage          → src/views/sidebarActions.js (updateStorageUsageUI)
 *  - tag cloud (dynamic)    → src/views/sidebar.js
 *
 * The markup is split into single-concern section modules under ./sections/;
 * sidebarHtml() composes them in the monolith DOM order. mountSidebar()
 * inserts the sidebar as the FIRST child of the #appBody wrapper
 * (insertAdjacentHTML "afterbegin"), preserving the monolith DOM
 * order (header > body-wrapper > [sidebar, main]).
 */

import { sidebarFoldersSectionHtml } from './sections/folders.js';
import { sidebarLanguageFiltersSectionHtml } from './sections/languageFilters.js';
import { sidebarTagCloudSectionHtml } from './sections/tags.js';
import { sidebarStorageSectionHtml } from './sections/storage.js';

/** @returns {string} The sidebar markup. */
export function sidebarHtml() {
  return `
    <!-- Left Sidebar -->
    <aside
      class="w-72 bg-slate-800/50 border-r border-slate-700/80 flex flex-col shrink-0 overflow-y-auto p-4 space-y-6">

${sidebarFoldersSectionHtml()}

${sidebarLanguageFiltersSectionHtml()}

${sidebarTagCloudSectionHtml()}

${sidebarStorageSectionHtml()}
    </aside>
`;
}

/**
 * Insert the sidebar as the first child of the #appBody wrapper
 * (monolith DOM order: header > body-wrapper > [sidebar, main]).
 */
export function mountSidebar() {
  document.getElementById('appBody').insertAdjacentHTML('afterbegin', sidebarHtml());
}
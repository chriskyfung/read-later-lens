/**
 * @fileoverview Left sidebar — presentational markup only.
 *
 * The core markup structure (sidebar wrapper, section modules, folder rows,
 * trash rows, storage usage, tag cloud) is preserved from the monolith;
 * Tailwind classes and DOM hooks match the original byte-for-byte. The markup
 * is split into single-concern section modules under ./sections/;
 * sidebarHtml() composes them in the monolith DOM order. mountSidebar()
 * inserts the sidebar as the FIRST child of the #appBody wrapper
 * (insertAdjacentHTML "afterbegin"), preserving the monolith DOM
 * order (header > body-wrapper > [sidebar, main]).
 *
 * Behavior mapping:
 *  - folder rows (dynamic)  → ../behavior/folders.js (renderer)
 *  - folder select/delete   → ../behavior/listeners.js (delegated listeners)
 *  - allFolderBtn / trashFolderBtn / languageFilters → ../behavior/listeners.js
 *  - trash rows (dynamic)   → src/features/trash/ (renderer)
 *  - storage usage          → ../behavior/storage.js (updateStorageUsageUI)
 *  - tag cloud (dynamic)    → ../behavior/tags.js
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
      class="w-72 bg-slate-800/50 border-r border-slate-700/80 flex flex-col shrink-0 overflow-y-auto p-4 gap-6">

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

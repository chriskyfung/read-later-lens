/**
 * @fileoverview Sidebar presentational barrel.
 *
 * Single import point for the pure sidebar markup/helpers in
 * src/components/sidebar/: the page-level panel (panel.js), the folder-row
 * class/badge/markup builders (folderRow.js) and the tag-pill helpers
 * (tagPill.js), plus the single-concern section modules under sections/.
 * The DOM-owning view layer (src/views/sidebar/) imports the builders it
 * needs; consumers that only need markup reach through this barrel.
 */

export { sidebarHtml, mountSidebar } from './panel.js';

export {
  sidebarAllFolderBtnClass,
  sidebarFolderItemClass,
  sidebarTrashBtnClass,
  sidebarFolderBadgeColorClass,
  sidebarFolderItemHtml,
} from './folderRow.js';

export {
  sidebarTagCloudEmptyStateHtml,
  sidebarTagPillClass,
  sidebarTagPillLabel,
} from './tagPill.js';

export { sidebarFoldersSectionHtml } from './sections/folders.js';
export { sidebarLanguageFiltersSectionHtml } from './sections/languageFilters.js';
export { sidebarTagCloudSectionHtml } from './sections/tags.js';
export { sidebarStorageSectionHtml } from './sections/storage.js';

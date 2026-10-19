/**
 * @fileoverview Top navigation header — presentational markup only.
 *
 * The markup now lives in src/components/header/ (shell, branding, searchBar,
 * actions, constants) and this module re-exports the stable public surface
 * so importers (src/main.js, tests) keep working unchanged.
 *
 * Behavior mapping (unchanged):
 *  - searchInput / clearSearchBtn / clearCacheBtn → src/views/header.js
 *  - importBtn / fileInput → src/io/importer.js
 *  - saveBackBtn → src/io/exporter.js
 *
 * mountHeader() inserts the header as the FIRST child of <body>
 * (insertAdjacentHTML 'afterbegin'), preserving the monolith's DOM order.
 */

export { headerHtml, mountHeader } from './header/index.js';
export { HEADER_IDS } from './header/constants.js';

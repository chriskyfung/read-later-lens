/**
 * @fileoverview Exporter facade — presentational surface unchanged.
 *
 * The export/save-back flow lives in src/io/export/* (modal, column
 * projection, SQLite DDL, per-source writer, unified exports, listener
 * wiring). This file preserves the original import path and export names so
 * src/main.js, src/views/modalListeners.js and the test suite need no changes.
 *
 * Behavior mapping:
 *  - saveBackBtn / closeSaveBtn / unified export buttons → src/io/export/listeners.js
 *  - #saveSourceFilesList delegation                   → src/io/export/listeners.js
 *  - per-source 儲存/下載                                → src/io/export/singleFile.js
 */

export {
  renderSaveModal,
  openSaveModal,
  closeSaveModal,
  saveSingleFile,
  exportAllUnifiedJson,
  exportAllUnifiedCsv,
  EXPORT_LISTENERS,
  registerExporterListeners,
} from './export/index.js';

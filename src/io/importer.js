/**
 * @fileoverview Importer facade — re-exports the public import API so every
 * existing import site (src/main.js, src/views/modalListeners.js and the test
 * files) keeps working unchanged.
 *
 * The implementation now lives in src/io/import/:
 *  - constants.js   shared error-flag markers
 *  - messages.js    pure toast/name builders
 *  - deps.js        initImporter/getDeps dependency-injection seam
 *  - picker.js      source-picker modal selection + keyboard
 *  - duplicates.js  duplicate-filename prompt flow
 *  - envelope.js    unified-export source expansion
 *  - parsing.js     CSV/JSON/SQLite parsing + staging
 *  - transaction.js snapshot → commit → persist → rollback
 *  - batch.js       batch orchestration + the single batch toast
 *  - listeners.js   DOM listener wiring
 */

export {
  applyProfileSelection,
  closeImportModal,
  createUniqueSourceName,
  handleFileUploads,
  initImporter,
  openImportModal,
  registerImporterListeners,
} from './import/index.js';

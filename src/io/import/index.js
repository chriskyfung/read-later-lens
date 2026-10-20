/**
 * @fileoverview Import module barrel — the only surface src/io/importer.js
 * (and its tests) should reach through. Mirrors the trash/header facades.
 */

export { initImporter } from './deps.js';
export { applyProfileSelection, closeImportModal, openImportModal } from './picker.js';
export { createUniqueSourceName } from './messages.js';
export { handleFileUploads } from './batch.js';
export { registerImporterListeners } from './listeners.js';

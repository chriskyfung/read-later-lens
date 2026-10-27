/**
 * @fileoverview Import module barrel — stable public surface for the split.
 *
 * Importers reach through this barrel (src/io/import/index.js), not into the
 * individual modules, so the internal file layout can evolve without touching
 * callers. Mirrors the trash/header facades.
 */

export { initImporter } from './deps.js';
export { applyProfileSelection, closeImportModal, openImportModal } from './picker.js';
export { createUniqueSourceName } from './messages.js';
export { handleFileUploads } from './batch.js';
export { registerImporterListeners } from './listeners.js';

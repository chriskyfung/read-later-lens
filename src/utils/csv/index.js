/**
 * @fileoverview CSV boundary barrel — stable public surface for the split.
 *
 * Importers reach through this barrel (src/utils/csv/index.js), not into the
 * individual modules, so the internal file layout can evolve without touching
 * callers. Mirrors src/utils/dom/index.js.
 */
export { captureCsvDialect, csvUnparseConfig } from './dialect.js';
export { hardenCsvValue, hardenRecordForCsv, hardenRecordsForCsv } from './harden.js';

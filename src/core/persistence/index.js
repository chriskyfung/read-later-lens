/**
 * @fileoverview Barrel for the IndexedDB persistence layer.
 *
 * Every name the rest of the app uses comes through here, so the whole layer
 * shares one set of module singletons (the connection promise and the revision
 * baseline) no matter which submodule a caller reaches for.
 */

export { saveState } from './save.js';
export { loadState } from './load.js';
export { isStateFresh } from './freshness.js';
export { getStorageUsage } from './storage.js';
export { closeDb } from './connection.js';

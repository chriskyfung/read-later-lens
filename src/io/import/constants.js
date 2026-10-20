/** @fileoverview Import error-flag markers shared across parsing, transaction
 * and batch modules. Read by `err[FLAG]` checks so a single source of truth
 * names each failure class. */

/** Marker property on the unsupported-extension error, read by the catch. */
export const UNSUPPORTED_TYPE_FLAG = 'unsupportedFileType';

/** Marker property on the blocked-source (official Instapaper CSV) error. */
export const UNSUPPORTED_SOURCE_FLAG = 'unsupportedSourceFile';

/** Marker property on the cache-write failure raised at the transaction boundary. */
export const PERSIST_FAILED_FLAG = 'persistFailed';

/**
 * Marker property narrowing {@link PERSIST_FAILED_FLAG} to "another tab wrote
 * to the shared cache first". The import is rolled back either way, but the
 * user needs the real reason: re-importing keeps failing until they reload.
 *
 * The user-facing reason is the guard's shared `STALE_STATE_REASON`, so a
 * wording change in one place updates every conflict surface together.
 */
export const CONFLICT_FLAG = 'cacheConflict';

/** Marker property when an overwrite file contains zero valid bookmark records. */
export const EMPTY_OVERWRITE_FLAG = 'emptyOverwriteReplacement';

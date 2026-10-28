/**
 * @fileoverview Source-file registry state + mutators.
 *
 * Owns the `sourceFiles` binding and the source-file deletion transition.
 * Re-exported through `src/core/state`.
 */

/**
 * @typedef {object} SourceFileRecord
 *
 * The `null` each optional field below documents is its PERSISTED shape, and so
 * also what the record carries once `saveState` has written it. In memory the
 * field is simply `undefined` on both paths that never set one: a record of a
 * type the field does not describe, and a row cached by a version that predates
 * the field. `saveState` normalises both to `null` (`?? null`), and every
 * consumer falls back the same way for each, so the difference is never
 * observable in exported bytes.
 *
 * @property {string} id
 * @property {string} name             Human-readable file name.
 * @property {string} type             'csv' | 'json' | 'sqlite' | 'db'.
 * @property {string} [profile]        Import profile id chosen in the source
 *   picker (see src/providers/profiles.js), e.g. 'instapaper-scraper'.
 * @property {string|Uint8Array|null} [originalData] Serialized original payload (null for SQL).
 * @property {{table: string, columns: string[]}|null} [sqliteSchema] The table
 *   name and column list a `.db` source was read from, so save-back re-emits
 *   the source's own layout. Persisted (it is small); `null` for other types,
 *   for a file with no table, and for sources cached by a version that predates
 *   this field — those are refused rather than re-emitted with a guessed shape.
 * @property {string[]|null} [csvColumns] The header row a CSV source was read
 *   from, in order, so save-back re-emits the source's own columns rather than
 *   the app's internal schema. Persisted (it is tiny, unlike the payload);
 *   `null` for non-CSV sources, for a file Papa reported no headers for, and
 *   for sources cached by a version that predates this field — those fall back
 *   to the profile default rather than a guessed layout.
 * @property {{delimiter?: string, linebreak?: string}|null} [csvDialect] The
 *   delimiter and line terminator a CSV source was actually written with, as
 *   PapaParse reported them, so save-back re-emits the file in its own dialect
 *   instead of always comma + CRLF. Each half is optional (a file with an
 *   unreadable terminator still keeps its delimiter). Persisted (two short
 *   strings); null for non-CSV sources, for a meta Papa could not describe, and
 *   for sources cached by a version that predates this field — those fall
 *   back to RFC 4180 rather than a guessed dialect.
 */

import { bookmarks, setBookmarks } from './bookmarks.js';
import { activeFolder, setActiveFolder } from './session.js';

/** @type {Map<string, SourceFileRecord>} */
export let sourceFiles = new Map();

export function setSourceFiles(v) {
  sourceFiles = v;
}

/** @param {string} sourceFileId */
export function removeSourceFile(sourceFileId) {
  sourceFiles.delete(sourceFileId);
  const next = bookmarks.filter((b) => b.source_file_id !== sourceFileId);
  setBookmarks(next);
  if (activeFolder === sourceFileId) setActiveFolder('ALL');
}

/**
 * @fileoverview Application state — single source of truth.
 *
 * The state lives in module-level bindings (not a class) so it can be
 * serialized to/from IndexedDB via `JSON.stringify`. Views mutate state
 * only through the setters below; `renderAll()` must be called afterwards.
 *
 * This is a *thin facade* over `src/core/state/*.js`. Splitting the file into
 * focused submodules keeps each concern isolated without forcing every
 * importer to rewrite its import path: every public name — the bindings, the
 * mutators, and the `SourceFileRecord` typedef — is re-exported from here.
 *
 * Layout:
 *   state/bookmarks.js — bookmark library + index + all bookmark transitions.
 *   state/sources.js   — source-file registry + removeSourceFile.
 *   state/session.js   — UI/session bindings (folder/lang/tag/tab/search/sort/selection).
 *   state/sql.js       — cached SQL.js engine.
 *   state/index.js     — internal barrel.
 *
 * The names are re-exported, never wrapped: `vi.spyOn(state, ...)` on this
 * module must still reach the implementation the callers read.
 */
export {
  bookmarks,
  getBookmarkById,
  setBookmarks,
  mergeBookmarks,
  trashBookmarks,
  restoreBookmarks,
  purgeBookmarks,
  isTrashed,
  isFavorite,
  setFavorite,
  toggleFavorite,
} from './state/index.js';
export { sourceFiles, setSourceFiles, removeSourceFile } from './state/index.js';
export {
  activeFolder,
  activeLang,
  activeTag,
  activeTab,
  searchQuery,
  sortBy,
  selectedIds,
  setActiveFolder,
  setActiveLang,
  setActiveTag,
  setActiveTab,
  setSearchQuery,
  setSortBy,
  setSelectedIds,
} from './state/index.js';
export { SQL, setSQL } from './state/index.js';

/** @typedef {import('./state/sources.js').SourceFileRecord} SourceFileRecord */

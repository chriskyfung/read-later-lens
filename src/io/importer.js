/**
 * @fileoverview Importer module for handling CSV, JSON, and SQLite files.
 * Extracts the file-import flow from the monolithic index.html.
 */

import * as state from '../core/state.js';
import { resolveImportAdapter } from '../providers/index.js';
import { checkImport, defaultProfileId, selectableProfiles } from '../providers/profiles.js';
import { SELECTED_CARD_CLASSES, UNSELECTED_CARD_CLASSES } from '../components/io/importModal.js';
import { showToast, pushLayer, popLayer, topLayerId } from '../utils/dom.js';
import { initSql } from './sqlLoader.js';

/**
 * Dependencies injected from the main application orchestrator.
 * @typedef {object} ImporterDeps
 * @property {function} persistAndRender - Callback to save state to IndexedDB and
 *   re-render views. Resolves to `{persisted, rendered}` (see src/main.js), or to
 *   nothing for a fire-and-forget stub. `persisted: false` marks a failed cache
 *   write, which the importer rolls back.
 * @property {function} [render] - Re-render the views after state is rolled back.
 *   Persistence is intentionally not retried here: the transaction already failed
 *   to reach storage, and the rollback must only make the in-memory session match
 *   what the next reload will show.
 */
let deps = {
  persistAndRender: () => {},
  render: () => {},
};

/**
 * Initialize importer with necessary side-effect callbacks.
 * @param {ImporterDeps} injectedDeps
 */
export function initImporter(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

// ------------------------------------------------------------------
// Import source picker modal
//
// The header 匯入 button opens this modal instead of the raw file dialog.
// Selection is explicit (no auto-detect): the chosen profile is remembered
// for the session and stamped onto every source file imported afterwards.
// ------------------------------------------------------------------

/** Currently selected source profile id (session-only; defaults to InstapaperScraper). */
let selectedProfileId = defaultProfileId();

/**
 * @param {string} profileId
 * @returns {HTMLElement|null} The profile's radio card element.
 */
function cardEl(profileId) {
  return document.getElementById(`importProfile-${profileId}`);
}

/**
 * Select a source profile: remember it and sync the radio cards' aria state
 * and selected/unselected border classes. Exported so tests (and the modal
 * opener) can reset the session default deterministically.
 *
 * @param {string} profileId
 */
export function applyProfileSelection(profileId) {
  selectedProfileId = profileId;
  for (const { id } of selectableProfiles()) {
    const card = cardEl(id);
    if (!card || !card.classList) continue;
    card.setAttribute?.('aria-checked', String(id === profileId));
    const checked = id === profileId;
    for (const name of checked ? UNSELECTED_CARD_CLASSES : SELECTED_CARD_CLASSES) {
      card.classList.remove(name);
    }
    for (const name of checked ? SELECTED_CARD_CLASSES : UNSELECTED_CARD_CLASSES) {
      card.classList.add(name);
    }
  }
}

/**
 * Open the source picker modal as a stack layer (Esc, focus trap and inert
 * background come from the shared layer stack). Re-entrant clicks are no-ops.
 */
export function openImportModal() {
  if (topLayerId() === 'importModal') return;
  applyProfileSelection(selectedProfileId);
  pushLayer('importModal');
}

/** Close the source picker, revealing whatever modal (if any) is beneath it. */
export function closeImportModal() {
  popLayer('importModal');
}

/**
 * Arrow/Home/End navigation within the radiogroup (Enter/Space already fire
 * click natively on the card buttons). Wraps around both ends.
 *
 * @param {KeyboardEvent} event
 */
function handleProfileKeydown(event) {
  const list = selectableProfiles();
  const idx = list.findIndex((profile) => profile.id === selectedProfileId);
  let next = null;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    next = list[(idx + 1) % list.length];
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    next = list[(idx - 1 + list.length) % list.length];
  } else if (event.key === 'Home') {
    next = list[0];
  } else if (event.key === 'End') {
    next = list[list.length - 1];
  }
  if (!next) return;
  event.preventDefault?.();
  applyProfileSelection(next.id);
  const card = cardEl(next.id);
  if (card && typeof card.focus === 'function') card.focus();
}

/**
 * Logic for resolving duplicate filename conflicts via a modal promise.
 */
function waitForDuplicateResolution() {
  return new Promise((resolve) => {
    const modal = document.getElementById('duplicateModal');
    const btnOverwrite = document.getElementById('dupBtnOverwrite');
    const btnKeep = document.getElementById('dupBtnKeepBoth');
    const btnCancel = document.getElementById('dupBtnCancel');

    const cleanup = () => {
      // The modal markup is optional: a missing node must not turn a resolution
      // into a TypeError in the middle of the import flow.
      btnOverwrite?.removeEventListener('click', onOverwrite);
      btnKeep?.removeEventListener('click', onKeep);
      btnCancel?.removeEventListener('click', onCancel);
      modal?.classList.add('hidden');
    };

    const onOverwrite = () => {
      cleanup();
      resolve('overwrite');
    };
    const onKeep = () => {
      cleanup();
      resolve('keep');
    };
    const onCancel = () => {
      cleanup();
      resolve('cancel');
    };

    btnOverwrite.addEventListener('click', onOverwrite);
    btnKeep.addEventListener('click', onKeep);
    btnCancel.addEventListener('click', onCancel);

    modal.classList.remove('hidden');
  });
}

/**
 * Create a source name that is unique against the current source-file names.
 * File names are compared exactly, matching the importer's duplicate policy;
 * timestamp collisions and extension-less names are handled deterministically.
 *
 * @param {string} originalName
 * @param {Iterable<string>} existingNames
 * @returns {string}
 */
export function createUniqueSourceName(originalName, existingNames) {
  const usedNames = new Set(existingNames);
  const dot = originalName.lastIndexOf('.');
  const hasExtension = dot > 0 && dot < originalName.length - 1;
  const stem = hasExtension ? originalName.slice(0, dot) : originalName;
  const extension = hasExtension ? originalName.slice(dot) : '';
  const timestamp = Date.now();

  let candidate = `${stem}_${timestamp}${extension}`;
  let suffix = 1;
  while (usedNames.has(candidate)) {
    candidate = `${stem}_${timestamp}_${suffix}${extension}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Wrap PapaParse's callback API into a promise so the CSV path is awaitable
 * like the JSON and SQLite paths. This guarantees the success/failure toast
 * is emitted *after* parsing completes, and that parse errors surface through
 * the same catch as every other format.
 *
 * Papa is a global provided by the script tag in index.html.
 * @param {string} text
 * @returns {Promise<{data: object[], errors: object[]}>}
 */
function parseCsvWithPapa(text) {
  return new Promise((resolve, reject) => {
    globalThis.Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results),
      error: (err) => reject(err),
    });
  });
}

/**
 * Build the toast message for a completed import.
 *
 * Priority: partial failure (parse errors or URL-less rows dropped) > empty
 * result > trash-displacement note > plain success. An unsupported-extension
 * import never reaches here (it throws and lands in the failure toast
 * instead). A non-blocking `note` (header/profile mismatch warning) is
 * appended last.
 *
 * @param {string} finalName
 * @param {number} displaced  Trashed records the fresh import replaced.
 * @param {number} count      Imported bookmark count (adapter output).
 * @param {number} skipped    CSV rows Papa could not parse.
 * @param {number} [dropped]  Rows the adapter dropped (no usable URL).
 * @param {string} [note]     Optional sanity-check warning to append.
 * @returns {string}
 */
function buildImportedMessage(finalName, displaced, count, skipped, dropped = 0, note = '') {
  const parts = [];
  if (skipped > 0) parts.push(`${skipped} 列解析失敗`);
  if (dropped > 0) parts.push(`${dropped} 筆缺少網址`);

  let message;
  if (parts.length > 0) {
    message = `已載入檔案: ${finalName}（${count} 筆書籤，${parts.join('、')}已略過）`;
  } else if (count === 0) {
    message = `已載入檔案: ${finalName}，但未偵測到任何書籤`;
  } else if (displaced > 0) {
    message = `已成功載入檔案: ${finalName}（${displaced} 筆已存在於回收桶的書籤已被新匯入資料取代）`;
  } else {
    message = `已成功載入檔案: ${finalName}`;
  }
  return note ? `${message}；${note}` : message;
}

/** Marker property on the unsupported-extension error, read by the catch. */
const UNSUPPORTED_TYPE_FLAG = 'unsupportedFileType';

/** Marker property on the blocked-source (official Instapaper CSV) error. */
const UNSUPPORTED_SOURCE_FLAG = 'unsupportedSourceFile';

/** Marker property on the cache-write failure raised at the transaction boundary. */
const PERSIST_FAILED_FLAG = 'persistFailed';

/** Marker property when an overwrite file contains zero valid bookmark records. */
const EMPTY_OVERWRITE_FLAG = 'emptyOverwriteReplacement';

/**
 * Run the header sanity check for a parsed file. Throws for a blocked source
 * (official Instapaper CSV — would otherwise import as garbage rows); returns
 * a non-blocking warning note for a profile/column mismatch, or '' when ok.
 *
 * SQLite files are intentionally not checked: the official export is CSV-only
 * and both supported table shapes (articles / bookmarks) already parse.
 *
 * @param {string} profile   Chosen source profile id.
 * @param {'csv'|'json'} ext Parsed file kind.
 * @param {object} parsed    Papa results (csv) or the parsed JSON root.
 * @param {object[]} rows    Extracted record rows (for key fallback).
 * @returns {string} Warning note ('' when ok).
 * @throws {Error} When the source is explicitly unsupported.
 */
function sanityCheckOrThrow(profile, ext, parsed, rows) {
  let sample;
  if (ext === 'csv') {
    const csvHeaders = parsed.meta?.fields ?? (rows[0] ? Object.keys(rows[0]) : []);
    sample = { csvHeaders };
  } else {
    sample = { jsonRoot: parsed, jsonKeys: rows[0] ? Object.keys(rows[0]) : [] };
  }

  const result = checkImport(profile, sample);
  if (result.verdict === 'unsupported') {
    const err = new Error(result.message);
    err[UNSUPPORTED_SOURCE_FLAG] = true;
    throw err;
  }
  return result.verdict === 'mismatch' ? result.message : '';
}

/**
 * Prepare a single uploaded file by parsing, validating and normalizing it
 * into a staging result without mutating global application state.
 *
 * @param {File} file
 * @param {string} finalName
 * @param {string} profile Import profile id chosen in the source picker.
 * @returns {Promise<{
 *   fileRecord: import('../core/state.js').SourceFileRecord,
 *   records: import('../model/BookmarkRecord.js').BookmarkRecord[],
 *   count: number,
 *   skipped: number,
 *   dropped: number,
 *   checkNote: string,
 * }>}
 */
async function prepareSingleFile(file, finalName, profile) {
  const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const ext = finalName.split('.').pop().toLowerCase();

  const fileRecord = {
    id: fileId,
    name: finalName,
    type: ext,
    profile,
    originalData: null,
    fileHandle: file,
  };

  const adapter = resolveImportAdapter(profile);
  let checkNote = '';
  let count = 0;
  let skipped = 0;
  let dropped = 0;
  let records = [];

  if (ext === 'csv') {
    const text = await file.text();
    fileRecord.originalData = text;
    const results = await parseCsvWithPapa(text);
    const rows = results.data || [];
    const parseErrors = results.errors || [];
    if (rows.length === 0 && parseErrors.length > 0) {
      throw new Error('CSV 解析失敗');
    }
    checkNote = sanityCheckOrThrow(profile, 'csv', results, rows);
    records = adapter.importJsonOrCsv(rows, fileRecord.id, fileRecord.name);
    count = records.length;
    skipped = parseErrors.length;
    dropped = rows.length - records.length;
  } else if (ext === 'json') {
    const text = await file.text();
    fileRecord.originalData = text;
    const parsed = JSON.parse(text);
    const arrayData = Array.isArray(parsed) ? parsed : parsed.bookmarks || [parsed];
    checkNote = sanityCheckOrThrow(profile, 'json', parsed, arrayData);
    records = adapter.importJsonOrCsv(arrayData, fileRecord.id, fileRecord.name);
    count = records.length;
    dropped = arrayData.length - records.length;
  } else if (ext === 'db' || ext === 'sqlite') {
    const arrayBuffer = await file.arrayBuffer();
    const uInt8Array = new Uint8Array(arrayBuffer);
    fileRecord.originalData = uInt8Array;
    const sqlEngine = await initSql();
    records = await adapter.importSqlite(uInt8Array, fileRecord.id, fileRecord.name, sqlEngine);
    count = records.length;
  } else {
    const err = new Error(`不支援的檔案格式「.${ext}」`);
    err[UNSUPPORTED_TYPE_FLAG] = true;
    throw err;
  }

  return { fileRecord, records, count, skipped, dropped, checkNote };
}

/**
 * Capture a complete snapshot of in-memory state that an import or overwrite
 * could mutate, so failed writes or rollbacks can rewind deterministically.
 */
function captureImportSnapshot() {
  return {
    sourceFiles: new Map(state.sourceFiles),
    bookmarks: [...state.bookmarks],
    selectedIds: new Set(state.selectedIds),
    activeFolder: state.activeFolder,
  };
}

/**
 * Restore in-memory state exactly to a previously captured snapshot.
 *
 * @param {ReturnType<typeof captureImportSnapshot>} snapshot
 */
function restoreImportSnapshot(snapshot) {
  state.setSourceFiles(new Map(snapshot.sourceFiles));
  state.setBookmarks([...snapshot.bookmarks]);
  state.setSelectedIds(new Set(snapshot.selectedIds));
  state.setActiveFolder(snapshot.activeFolder);
}

/**
 * Process a single uploaded file, parsing it and updating state.
 *
 * Transaction shape: parse & validate into staging → commit to working set →
 * persist. Overwrite purges the previous source and its active/trashed
 * bookmarks in the SAME transaction, so a malformed or empty replacement leaves
 * the previous source intact.
 *
 * @param {File} file
 * @param {string} finalName
 * @param {string} profile Import profile id chosen in the source picker.
 * @param {object} [options]
 * @param {string|null} [options.replaceSourceId] Replaced source id when overwriting.
 */
async function processSingleFile(file, finalName, profile, options = {}) {
  const { replaceSourceId = null } = options;
  const ext = finalName.split('.').pop().toLowerCase();
  const snapshot = captureImportSnapshot();

  try {
    const prepared = await prepareSingleFile(file, finalName, profile);

    // Overwrite safety: an overwrite choice replaces data, but must never
    // destroy an existing source for an empty file (0 valid bookmarks).
    if (replaceSourceId && prepared.count === 0) {
      const err = new Error('新檔案未匯入任何有效書籤，已保留原來源檔案');
      err[EMPTY_OVERWRITE_FLAG] = true;
      throw err;
    }

    if (replaceSourceId) {
      const doomedIds = state.bookmarks
        .filter((b) => b.source_file_id === replaceSourceId)
        .map((b) => b.id);
      const doomedSet = new Set(doomedIds);
      state.sourceFiles.delete(replaceSourceId);
      state.purgeBookmarks(doomedIds);
      state.setSelectedIds(new Set([...state.selectedIds].filter((id) => !doomedSet.has(id))));
      if (state.activeFolder === replaceSourceId) {
        state.setActiveFolder('ALL');
      }
    }

    // Register the source record and merged bookmarks into the live working
    // set, then cross the transaction boundary with storage.
    state.sourceFiles.set(prepared.fileRecord.id, prepared.fileRecord);
    const merge = acceptRecords(prepared.records);

    if (!(await persistWorkingSet())) {
      const err = new Error('無法寫入本機快取');
      err[PERSIST_FAILED_FLAG] = true;
      throw err;
    }

    showToast(
      buildImportedMessage(
        finalName,
        merge.displaced,
        prepared.count,
        prepared.skipped,
        prepared.dropped,
        prepared.checkNote,
      ),
    );
  } catch (err) {
    restoreImportSnapshot(snapshot);
    try {
      deps.render?.();
    } catch (renderErr) {
      console.warn('Rollback render failed:', renderErr);
    }

    if (err[EMPTY_OVERWRITE_FLAG]) {
      showToast(err.message);
      return;
    }

    console.error(`解析檔案 ${finalName} 失敗:`, err);
    showToast(
      err[PERSIST_FAILED_FLAG]
        ? `已還原匯入 ${finalName}：無法寫入本機快取，資料不會保留`
        : err[UNSUPPORTED_TYPE_FLAG]
          ? `不支援的檔案格式「.${ext}」，請上傳 CSV、JSON 或 SQLite 檔案`
          : err[UNSUPPORTED_SOURCE_FLAG]
            ? err.message
            : `解析檔案 ${finalName} 失敗，請確認格式`,
    );
  }
}

/**
 * Merge new records into global state and report what the merge did.
 *
 * Before merging, count how many trashed records the incoming data displaces:
 * mergeBookmarks() is "incoming wins", so a re-import always overwrites a
 * trashed record with the fresh one (the item silently returns to the active
 * list). The count is RETURNED instead of parked in a module global — an
 * out-of-band channel lets a late callback overwrite another file's number and
 * so report the wrong trash count in the toast.
 *
 * Persisting is deliberately NOT part of this function: the merge is only one
 * half of the import transaction, and the caller closes it once the whole file
 * has been parsed (see persistWorkingSet). Rollback does not need an undo
 * record from here — processSingleFile() restores a full snapshot captured
 * before parsing, so a failed write rewinds the purge and the merge together.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} newBookmarks
 * @returns {{displaced: number}} `displaced`: trashed records this batch resurrected.
 */
function acceptRecords(newBookmarks) {
  const incomingIds = new Set(newBookmarks.map((b) => b.id));
  const displaced = state.bookmarks.filter((b) => b.deleted_at && incomingIds.has(b.id)).length;
  state.mergeBookmarks(newBookmarks);
  return { displaced };
}

/**
 * Cross the import transaction boundary: hand the merged working set to storage
 * by AWAITING deps.persistAndRender().
 *
 * The promise is awaited rather than floated, so a failed write is observable
 * and the merged records can be rolled back. A persistAndRender stub that
 * returns nothing counts as committed (the legacy fire-and-forget contract,
 * still used by other callers); the real one reports `{persisted, rendered}`.
 *
 * @returns {Promise<boolean>} Whether the working set reached storage.
 */
async function persistWorkingSet() {
  const result = await deps.persistAndRender?.();
  if (result && typeof result === 'object') return result.persisted !== false;
  return result !== false;
}

/**
 * Entry point for handling multiple file uploads.
 * @param {File[]} files
 * @param {object} [options]
 * @param {string} [options.profile] Source profile chosen in the picker
 *   (defaults to the session selection — InstapaperScraper unless changed).
 */
export async function handleFileUploads(files, options = {}) {
  const { profile = selectedProfileId } = options;

  try {
    for (let file of files) {
      const fileName = file.name;

      // Check for duplicate names
      let duplicateId = null;
      for (let [id, val] of state.sourceFiles.entries()) {
        if (val.name === fileName) {
          duplicateId = id;
          break;
        }
      }

      if (duplicateId) {
        document.getElementById('duplicateFileText').innerText =
          `已存在名為「${fileName}」的檔案。請選擇要如何處理？`;
        const action = await waitForDuplicateResolution();
        if (action === 'overwrite') {
          await processSingleFile(file, fileName, profile, { replaceSourceId: duplicateId });
        } else if (action === 'keep') {
          const existingNames = [...state.sourceFiles.values()].map((source) => source.name);
          const newName = createUniqueSourceName(fileName, existingNames);
          await processSingleFile(file, newName, profile);
        }
      } else {
        await processSingleFile(file, fileName, profile);
      }
    }
  } catch (err) {
    console.error('檔案匯入失敗:', err);
    showToast('檔案匯入失敗，請稍後再試');
  }
}

/**
 * Register DOM listeners for the header import button, the source picker
 * modal, and the hidden file input.
 */
export function registerImporterListeners() {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput) return;

  // Header 匯入 button opens the source picker instead of the raw file dialog.
  document.getElementById('importBtn')?.addEventListener('click', openImportModal);
  document.getElementById('closeImportBtn')?.addEventListener('click', closeImportModal);
  document.getElementById('importCancelBtn')?.addEventListener('click', closeImportModal);
  document.getElementById('importPickFileBtn')?.addEventListener('click', () => fileInput.click());

  // Source cards: click selection + arrow-key navigation within the radiogroup.
  for (const profile of selectableProfiles()) {
    cardEl(profile.id)?.addEventListener('click', () => applyProfileSelection(profile.id));
  }
  document.getElementById('importSourceGroup')?.addEventListener('keydown', handleProfileKeydown);

  // Backdrop click closes (clicks inside the panel bubble with another target).
  const overlay = document.getElementById('importModal');
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) closeImportModal();
  });

  fileInput.addEventListener('change', async (e) => {
    try {
      const files = e.target.files ? Array.from(e.target.files) : [];
      // A change event never fires when the same path is re-selected, so clear
      // the value once the FileList is captured.
      e.target.value = '';
      if (files.length === 0) return;
      // Close the picker BEFORE parsing so the duplicate-name prompt never
      // stacks beneath it (the duplicate modal stays outside the layer stack).
      closeImportModal();
      await handleFileUploads(files, { profile: selectedProfileId });
    } catch (err) {
      console.error('檔案匯入失敗:', err);
      showToast('檔案匯入失敗，請稍後再試');
    }
  });
}

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
 * @property {function} deleteFolder - Function to remove a source file and its bookmarks.
 */
let deps = {
  persistAndRender: () => {},
  deleteFolder: () => {},
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
 * Process a single uploaded file, parsing it and updating state.
 *
 * Transaction shape: register the source record → parse → merge → persist. Any
 * failure before the working set reaches storage is rolled back as a unit (see
 * rollbackImport), so the state an import leaves behind always matches what the
 * next reload will show — no orphaned bookmarks, no ghost folder.
 *
 * @param {File} file
 * @param {string} finalName
 * @param {string} profile Import profile id chosen in the source picker.
 */
async function processSingleFile(file, finalName, profile) {
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

  // Register the source record BEFORE parsing so any persistAndRender()
  // triggered while merging always observes complete state (folder list,
  // counts, persisted sources snapshot). A failed parse removes it again
  // (Option A): a failed import must leave no ghost folder behind.
  state.sourceFiles.set(fileId, fileRecord);

  const adapter = resolveImportAdapter(profile);
  let checkNote = '';
  let count = 0;
  let skipped = 0;
  let dropped = 0;
  /** Merge receipt: what was merged plus the snapshot needed to undo it. */
  let merge = null;

  try {
    if (ext === 'csv') {
      const text = await file.text();
      fileRecord.originalData = text;
      const results = await parseCsvWithPapa(text);
      const rows = results.data || [];
      const parseErrors = results.errors || [];
      if (rows.length === 0 && parseErrors.length > 0) {
        // Nothing usable came out — treat the whole file as failed.
        throw new Error('CSV 解析失敗');
      }
      checkNote = sanityCheckOrThrow(profile, 'csv', results, rows);
      const records = adapter.importJsonOrCsv(rows, fileRecord.id, fileRecord.name);
      // Counts come from the adapter OUTPUT so rows it dropped (no usable
      // URL) are reported instead of being counted as imported.
      count = records.length;
      skipped = parseErrors.length;
      dropped = rows.length - records.length;
      merge = acceptRecords(records);
    } else if (ext === 'json') {
      const text = await file.text();
      fileRecord.originalData = text;
      const parsed = JSON.parse(text);
      const arrayData = Array.isArray(parsed) ? parsed : parsed.bookmarks || [parsed];
      checkNote = sanityCheckOrThrow(profile, 'json', parsed, arrayData);
      const records = adapter.importJsonOrCsv(arrayData, fileRecord.id, fileRecord.name);
      count = records.length;
      dropped = arrayData.length - records.length;
      merge = acceptRecords(records);
    } else if (ext === 'db' || ext === 'sqlite') {
      const arrayBuffer = await file.arrayBuffer();
      const uInt8Array = new Uint8Array(arrayBuffer);
      fileRecord.originalData = uInt8Array;
      const sqlEngine = await initSql();
      const records = await adapter.importSqlite(
        uInt8Array,
        fileRecord.id,
        fileRecord.name,
        sqlEngine,
      );
      count = records.length;
      merge = acceptRecords(records);
    } else {
      const err = new Error(`不支援的檔案格式「.${ext}」`);
      err[UNSUPPORTED_TYPE_FLAG] = true;
      throw err;
    }

    // Close the transaction. A write that did not land means this session holds
    // records the user will not find after a reload, so the import is undone
    // instead of being reported as a success.
    if (!(await persistWorkingSet())) {
      const err = new Error('無法寫入本機快取');
      err[PERSIST_FAILED_FLAG] = true;
      throw err;
    }
  } catch (err) {
    rollbackImport(fileId, merge);
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
    return;
  }

  // Past the boundary the working set is durable, so nothing down here may fail
  // the import: a toast can never announce a rollback that did not happen.
  // Re-importing an id that sits in the trash replaces (resurrects) that
  // record, so say so explicitly instead of letting the trash count drop.
  showToast(buildImportedMessage(finalName, merge.displaced, count, skipped, dropped, checkNote));
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
 * has been parsed (see persistWorkingSet and processSingleFile).
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} newBookmarks
 * @returns {{displaced: number, before: import('../model/BookmarkRecord.js').BookmarkRecord[]}}
 *   `displaced`: trashed records this batch resurrected. `before`: the pre-merge
 *   snapshot, i.e. the undo record for rollbackImport().
 */
function acceptRecords(newBookmarks) {
  const incomingIds = new Set(newBookmarks.map((b) => b.id));
  const displaced = state.bookmarks.filter((b) => b.deleted_at && incomingIds.has(b.id)).length;
  const before = state.bookmarks;
  state.mergeBookmarks(newBookmarks);
  return { displaced, before };
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
 * Undo an import that never reached storage.
 *
 * Register → merge → persist is ONE unit, so a failure anywhere must undo BOTH
 * halves: the merged records (rewound to the pre-merge snapshot) and the source
 * record. Keeping either half alone desynchronizes the session from the cache —
 * records left behind point at a `source_file_id` that no longer exists, so they
 * vanish from the folder list and are gone after the next reload.
 *
 * @param {string} fileId
 * @param {{before: import('../model/BookmarkRecord.js').BookmarkRecord[]}|null} merge
 *   The merge receipt, or null when the import failed before merging.
 */
function rollbackImport(fileId, merge) {
  if (merge) state.setBookmarks(merge.before);
  state.sourceFiles.delete(fileId);
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
  await initSql();

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
        deps.deleteFolder(duplicateId, false);
        await processSingleFile(file, fileName, profile);
      } else if (action === 'keep') {
        const newName = fileName.replace(/(\.[\w\d_-]+)$/i, `_${Date.now()}$1`);
        await processSingleFile(file, newName, profile);
      }
    } else {
      await processSingleFile(file, fileName, profile);
    }
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

  fileInput.addEventListener('change', (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // A change event never fires when the same path is re-selected, so clear
    // the value once the FileList is captured.
    e.target.value = '';
    if (files.length === 0) return;
    // Close the picker BEFORE parsing so the duplicate-name prompt never
    // stacks beneath it (the duplicate modal stays outside the layer stack).
    closeImportModal();
    handleFileUploads(files, { profile: selectedProfileId });
  });
}

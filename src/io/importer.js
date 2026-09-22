/**
 * @fileoverview Importer module for handling CSV, JSON, and SQLite files.
 * Extracts the file-import flow from the monolithic index.html.
 */

import * as state from '../core/state.js';
import { importJsonOrCsv, importSqlite } from '../providers/index.js';
import { showToast } from '../utils/dom.js';
import { initSql } from './sqlLoader.js';

/**
 * Dependencies injected from the main application orchestrator.
 * @typedef {object} ImporterDeps
 * @property {function} persistAndRender - Callback to save state to IndexedDB and re-render views.
 * @property {function} deleteFolder - Function to remove a source file and its bookmarks.
 */
let deps = {
  persistAndRender: () => {},
  deleteFolder: () => {},
};

/**
 * How many trashed records the last merged import replaced (see acceptRecords).
 * Consumed and reset by processSingleFile()'s success toast.
 */
let lastTrashDisplaced = 0;

/**
 * Initialize importer with necessary side-effect callbacks.
 * @param {ImporterDeps} injectedDeps
 */
export function initImporter(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
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
      btnOverwrite.removeEventListener('click', onOverwrite);
      btnKeep.removeEventListener('click', onKeep);
      btnCancel.removeEventListener('click', onCancel);
      modal.classList.add('hidden');
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
 * Priority: partial CSV failure > empty result > trash-displacement note >
 * plain success. An unsupported-extension import never reaches here (it
 * throws and lands in the failure toast instead).
 *
 * @param {string} finalName
 * @param {number} displaced  Trashed records the fresh import replaced.
 * @param {number} count      Imported bookmark count.
 * @param {number} skipped    CSV rows Papa could not parse.
 * @returns {string}
 */
function buildImportedMessage(finalName, displaced, count, skipped) {
  if (skipped > 0) {
    return `已載入檔案: ${finalName}（${count} 筆書籤，${skipped} 列解析失敗已略過）`;
  }
  if (count === 0) {
    return `已載入檔案: ${finalName}，但未偵測到任何書籤`;
  }
  return displaced > 0
    ? `已成功載入檔案: ${finalName}（${displaced} 筆已存在於回收桶的書籤已被新匯入資料取代）`
    : `已成功載入檔案: ${finalName}`;
}

/** Marker property on the unsupported-extension error, read by the catch. */
const UNSUPPORTED_TYPE_FLAG = 'unsupportedFileType';

/**
 * Process a single uploaded file, parsing it and updating state.
 * @param {File} file
 * @param {string} finalName
 */
async function processSingleFile(file, finalName) {
  const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const ext = finalName.split('.').pop().toLowerCase();

  // A stale count from a previous file (or a late callback) must never leak
  // into this file's success toast.
  lastTrashDisplaced = 0;

  const fileRecord = {
    id: fileId,
    name: finalName,
    type: ext,
    originalData: null,
    fileHandle: file,
  };

  // Register the source record BEFORE parsing so any persistAndRender()
  // triggered while merging always observes complete state (folder list,
  // counts, persisted sources snapshot). A failed parse removes it again
  // (Option A): a failed import must leave no ghost folder behind.
  state.sourceFiles.set(fileId, fileRecord);

  try {
    let count = 0;
    let skipped = 0;

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
      count = rows.length;
      skipped = parseErrors.length;
      acceptRecords(importJsonOrCsv(rows, fileRecord.id, fileRecord.name));
    } else if (ext === 'json') {
      const text = await file.text();
      fileRecord.originalData = text;
      const parsed = JSON.parse(text);
      const arrayData = Array.isArray(parsed) ? parsed : parsed.bookmarks || [parsed];
      count = arrayData.length;
      acceptRecords(importJsonOrCsv(arrayData, fileRecord.id, fileRecord.name));
    } else if (ext === 'db' || ext === 'sqlite') {
      const arrayBuffer = await file.arrayBuffer();
      const uInt8Array = new Uint8Array(arrayBuffer);
      fileRecord.originalData = uInt8Array;
      const sqlEngine = await initSql();
      const records = await importSqlite(uInt8Array, fileRecord.id, fileRecord.name, sqlEngine);
      count = records.length;
      acceptRecords(records);
    } else {
      const err = new Error(`不支援的檔案格式「.${ext}」`);
      err[UNSUPPORTED_TYPE_FLAG] = true;
      throw err;
    }

    // Re-importing an id that sits in the trash replaces (resurrects) that
    // record, so say so explicitly instead of letting the trash count drop.
    const displaced = lastTrashDisplaced;
    lastTrashDisplaced = 0;
    showToast(buildImportedMessage(finalName, displaced, count, skipped));
  } catch (err) {
    state.sourceFiles.delete(fileId);
    lastTrashDisplaced = 0;
    console.error(`解析檔案 ${finalName} 失敗:`, err);
    showToast(
      err[UNSUPPORTED_TYPE_FLAG]
        ? `不支援的檔案格式「.${ext}」，請上傳 CSV、JSON 或 SQLite 檔案`
        : `解析檔案 ${finalName} 失敗，請確認格式`,
    );
  }
}

/**
 * Merge new records into global state and trigger persistence/render.
 *
 * Before merging, count how many trashed records the incoming data displaces:
 * mergeBookmarks() is "incoming wins", so a re-import always overwrites a
 * trashed record with the fresh one (the item silently returns to the active
 * list). The count is surfaced in the success toast by processSingleFile() so
 * the user knows a trash entry disappeared.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} newBookmarks
 */
function acceptRecords(newBookmarks) {
  const incomingIds = new Set(newBookmarks.map((b) => b.id));
  lastTrashDisplaced = state.bookmarks.filter((b) => b.deleted_at && incomingIds.has(b.id)).length;
  state.mergeBookmarks(newBookmarks);
  deps.persistAndRender();
}

/**
 * Entry point for handling multiple file uploads.
 * @param {File[]} files
 */
export async function handleFileUploads(files) {
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
        await processSingleFile(file, fileName);
      } else if (action === 'keep') {
        const newName = fileName.replace(/(\.[\w\d_-]+)$/i, `_${Date.now()}$1`);
        await processSingleFile(file, newName);
      }
    } else {
      await processSingleFile(file, fileName);
    }
  }
}

/**
 * Register DOM listeners for file input.
 */
export function registerImporterListeners() {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUploads(Array.from(e.target.files));
    }
  });
}

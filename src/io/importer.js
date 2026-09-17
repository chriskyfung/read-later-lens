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
  return new Promise(resolve => {
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

    const onOverwrite = () => { cleanup(); resolve('overwrite'); };
    const onKeep = () => { cleanup(); resolve('keep'); };
    const onCancel = () => { cleanup(); resolve('cancel'); };

    btnOverwrite.addEventListener('click', onOverwrite);
    btnKeep.addEventListener('click', onKeep);
    btnCancel.addEventListener('click', onCancel);

    modal.classList.remove('hidden');
  });
}

/**
 * Process a single uploaded file, parsing it and updating state.
 * @param {File} file
 * @param {string} finalName
 */
async function processSingleFile(file, finalName) {
  const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const ext = finalName.split('.').pop().toLowerCase();

  const fileRecord = {
    id: fileId,
    name: finalName,
    type: ext,
    originalData: null,
    fileHandle: file
  };

  try {
    if (ext === 'csv') {
      const text = await file.text();
      fileRecord.originalData = text;
      // Papa is a global provided by the script tag in index.html
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          acceptRecords(importJsonOrCsv(results.data, fileRecord.id, fileRecord.name));
        }
      });
    } else if (ext === 'json') {
      const text = await file.text();
      fileRecord.originalData = text;
      const parsed = JSON.parse(text);
      const arrayData = Array.isArray(parsed) ? parsed : (parsed.bookmarks || [parsed]);
      acceptRecords(importJsonOrCsv(arrayData, fileRecord.id, fileRecord.name));
    } else if (ext === 'db' || ext === 'sqlite') {
      const arrayBuffer = await file.arrayBuffer();
      const uInt8Array = new Uint8Array(arrayBuffer);
      fileRecord.originalData = uInt8Array;
      const sqlEngine = await initSql();
      const records = await importSqlite(uInt8Array, fileRecord.id, fileRecord.name, sqlEngine);
      acceptRecords(records);
    }

    state.sourceFiles.set(fileId, fileRecord);
    showToast(`已成功載入檔案: ${finalName}`);
  } catch (err) {
    console.error(`解析檔案 ${finalName} 失敗:`, err);
    showToast(`解析檔案 ${finalName} 失敗，請確認格式`);
  }
}

/**
 * Merge new records into global state and trigger persistence/render.
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} newBookmarks
 */
function acceptRecords(newBookmarks) {
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
      document.getElementById('duplicateFileText').innerText = `已存在名為「${fileName}」的檔案。請選擇要如何處理？`;
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

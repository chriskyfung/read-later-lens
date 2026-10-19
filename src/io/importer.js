/**
 * @fileoverview Importer module for handling CSV, JSON, and SQLite files.
 * Extracts the file-import flow from the monolithic index.html.
 */

import * as state from '../core/state.js';
import { STALE_STATE_REASON } from '../core/guard.js';
import { normalizeProfileId, selectableProfiles } from '../providers/profiles.js';
import { showToast } from '../utils/dom.js';
import {
  buildBatchSummary,
  buildImportedMessage,
  createUniqueSourceName,
  promptUnavailableMessage,
} from './import/messages.js';
import { deps } from './import/deps.js';
import {
  DUPLICATE_PROMPT_FLAG,
  duplicatePromptReady,
  findDuplicateSourceId,
  showDuplicatePrompt,
  waitForDuplicateResolution,
} from './import/duplicates.js';
import {
  applyProfileSelection,
  cardEl,
  closeImportModal,
  handleProfileKeydown,
  openImportModal,
  selectedProfileId,
} from './import/picker.js';
import {
  CONFLICT_FLAG,
  EMPTY_OVERWRITE_FLAG,
  PERSIST_FAILED_FLAG,
  UNSUPPORTED_SOURCE_FLAG,
  UNSUPPORTED_TYPE_FLAG,
} from './import/constants.js';
import { prepareSingleFile } from './import/parsing.js';

export { initImporter } from './import/deps.js';
export { applyProfileSelection, closeImportModal, openImportModal } from './import/picker.js';
export { createUniqueSourceName } from './import/messages.js';

/**
 * Create a source name that is unique against the current source-file names.
 * File names are compared exactly, matching the importer's duplicate policy;
 * timestamp collisions and extension-less names are handled deterministically.
 *
 * @param {string} originalName
 * @param {Iterable<string>} existingNames
 * @returns {string}
 */

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
 * @returns {Promise<object>} The per-file outcome for the batch summary:
 *   `{ status: 'imported', ... }` (message + counts) or
 *   `{ status: 'failed', finalName, message, reason }`. A handled failure
 *   (parse error, empty overwrite, cache-write failure) rolls itself back and
 *   resolves a failure outcome — it never throws past this function. Outcomes
 *   are reported, never toasted, because the caller's single toast element
 *   keeps only the last message a batch emits.
 */
async function processSingleFile(file, finalName, profile, options = {}) {
  const { replaceSourceId = null } = options;
  const ext = finalName.split('.').pop().toLowerCase();
  const snapshot = captureImportSnapshot();

  try {
    // The overwrite purge runs BEFORE staging, not after it.
    //
    // Staging asks the live working set which source ids are already loaded, to
    // decide what to reconstruct versus what to merge into. A purge that ran
    // afterwards would therefore be invisible to the very decision it is about to
    // invalidate: the group naming the doomed source would be merged rather than
    // rebuilt, and the purge would then delete the folder those records had just
    // been attached to — orphaning every one of them, with a success toast.
    //
    // The empty-overwrite guard below still keeps the source safe: it throws, and
    // the catch restores this same snapshot, so a replacement with no valid
    // bookmarks leaves the original exactly as it was.
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

    const prepared = await prepareSingleFile(file, finalName, profile);

    // Overwrite safety: an overwrite choice replaces data, but must never
    // destroy an existing source for an empty file (0 valid bookmarks).
    if (replaceSourceId && prepared.count === 0) {
      const err = new Error('新檔案未匯入任何有效書籤，已保留原來源檔案');
      err[EMPTY_OVERWRITE_FLAG] = true;
      throw err;
    }

    // Register the source record(s) and merged bookmarks into the live working
    // set, then cross the transaction boundary with storage. A unified export
    // can expand into several sources, and all of them land in this one
    // transaction — a failure rolls the whole expansion back together.
    for (const record of prepared.fileRecords) state.sourceFiles.set(record.id, record);
    const merge = acceptRecords(prepared.records);

    const saved = await persistWorkingSet();
    if (!saved.persisted) {
      // The conflict names itself with the guard's shared reason; a plain
      // write failure keeps its own wording.
      const reason = saved.conflict ? STALE_STATE_REASON : '無法寫入本機快取';
      const err = new Error(reason);
      err[PERSIST_FAILED_FLAG] = true;
      if (saved.conflict) err[CONFLICT_FLAG] = true;
      throw err;
    }

    const message = buildImportedMessage(
      finalName,
      merge.displaced,
      prepared.count,
      prepared.skipped,
      prepared.droppedNoUrl,
      prepared.checkNote,
    );
    return {
      status: 'imported',
      finalName,
      message,
      count: prepared.count,
      skipped: prepared.skipped,
      droppedNoUrl: prepared.droppedNoUrl,
      displaced: merge.displaced,
    };
  } catch (err) {
    restoreImportSnapshot(snapshot);
    try {
      deps.render?.();
    } catch (renderErr) {
      console.warn('Rollback render failed:', renderErr);
    }

    if (err[EMPTY_OVERWRITE_FLAG]) {
      return { status: 'failed', finalName, message: err.message, reason: '未匯入任何有效書籤' };
    }

    // Expected user and environment failures are diagnosed below each branch
    // by the message they return, so they never reach the error log: an
    // unsupported file, an unsupported source, and a refused cache write are
    // routine, not defects. Only the generic fallback underneath logs.
    if (err[PERSIST_FAILED_FLAG]) {
      if (err[CONFLICT_FLAG]) {
        return {
          status: 'failed',
          finalName,
          message: `已還原匯入 ${finalName}：${STALE_STATE_REASON}，資料不會保留，請重新載入後再試`,
          reason: STALE_STATE_REASON,
        };
      }
      return {
        status: 'failed',
        finalName,
        message: `已還原匯入 ${finalName}：無法寫入本機快取，資料不會保留`,
        reason: '無法寫入本機快取',
      };
    }
    if (err[UNSUPPORTED_TYPE_FLAG]) {
      return {
        status: 'failed',
        finalName,
        message: `不支援的檔案格式「.${ext}」，請上傳 CSV、JSON 或 SQLite 檔案`,
        reason: '格式不支援',
      };
    }
    if (err[UNSUPPORTED_SOURCE_FLAG]) {
      return { status: 'failed', finalName, message: err.message, reason: '來源檔案不受支援' };
    }
    console.error(`解析檔案 ${finalName} 失敗:`, err);
    return {
      status: 'failed',
      finalName,
      message: `解析檔案 ${finalName} 失敗，請確認格式`,
      reason: '解析失敗',
    };
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
 * still used by other callers); the real one reports `{persisted, rendered,
 * conflict}`. A conflict — another tab wrote between this tab's baseline and
 * the save — is reported distinctly so the failure says WHY instead of blaming
 * the cache.
 *
 * @returns {Promise<{persisted: boolean, rendered: boolean, conflict: boolean}>}
 *   Whether the working set reached storage, whether the view was refreshed
 *   from it, and whether storage refused the write because another tab changed
 *   it. The legacy contract reports `rendered: false`: a stub that says nothing
 *   proves nothing, so callers that must show fresh state re-render themselves.
 */
async function persistWorkingSet() {
  const result = await deps.persistAndRender?.();
  if (result && typeof result === 'object') {
    return {
      persisted: result.persisted !== false,
      rendered: result.rendered !== false,
      conflict: result.conflict === true,
    };
  }
  return { persisted: result !== false, rendered: false, conflict: false };
}

/**
 * Rewind a whole batch after an unexpected failure and re-sync the cache.
 *
 * The rewrite matters as much as the restore: every file the batch already
 * committed was individually persisted, so restoring only memory would leave a
 * cache the session's view no longer matches (a reload would resurrect the
 * files this rollback just removed). When the rewrite itself fails the toast
 * says so instead of claiming a clean restore.
 *
 * @param {ReturnType<typeof captureImportSnapshot>} snapshot Taken before the batch.
 * @param {string} fileName The file whose handling failed.
 * @returns {Promise<void>}
 */
async function rollbackBatch(snapshot, fileName) {
  restoreImportSnapshot(snapshot);

  let status = { persisted: false, rendered: false };
  try {
    status = await persistWorkingSet();
  } catch (err) {
    console.warn('Batch rollback write failed:', err);
  }

  if (!status.rendered) {
    try {
      deps.render?.();
    } catch (renderErr) {
      console.warn('Rollback render failed:', renderErr);
    }
  }

  showToast(
    status.persisted
      ? `匯入「${fileName}」時發生錯誤，已還原本次匯入的全部檔案`
      : `匯入「${fileName}」時發生錯誤，且無法還原快取；重新載入後可能仍會看到部分匯入結果`,
  );
}

/**
 * Entry point for handling multiple file uploads.
 * @param {File[]} files
 * @param {object} [options]
 * @param {string} [options.profile] Source profile chosen in the picker
 *   (defaults to the session selection — InstapaperScraper unless changed).
 *   Unknown ids coerce to the default before anything is stamped or checked.
 */
export async function handleFileUploads(files, options = {}) {
  try {
    const profile = normalizeProfileId(options.profile ?? selectedProfileId);
    const pending = [...files];

    // Fail-closed preflight: the duplicate prompt is the only interaction a
    // batch may need, and its absence is knowable BEFORE any state is mutated.
    // Refusing here keeps "no partial import" true by construction instead of
    // aborting halfway through this loop, which used to abandon the remaining
    // files behind a single generic toast.
    const collisions = pending.filter((file) => findDuplicateSourceId(file.name));
    if (collisions.length > 0 && !duplicatePromptReady()) {
      const names = collisions.map((file) => file.name).join('、');
      console.error('檔案匯入中止：無法顯示同名檔案的處理選項:', names);
      showToast(promptUnavailableMessage(names));
      return;
    }

    // Batch atomicity: a failure a file could not handle itself (an escape from
    // the prompt, the duplicate scan or the merge) rewinds every file this batch
    // committed, so the batch lands all-or-nothing instead of half-imported.
    // Failures processSingleFile reports and rolls back itself — parse errors,
    // empty overwrites, cache-write failures — do not trigger this: they are
    // reported per file and the batch carries on.
    const batchSnapshot = captureImportSnapshot();
    let committed = 0;
    // Per-file outcomes for the one toast this batch emits. processSingleFile
    // reports rather than toasts: the single `#toastMsg` element is
    // last-write-wins, so toasting per file would leave only the last file's
    // result visible. Deferred outcomes are discarded on rollback, so the
    // batch never claims a success it then rewound.
    const outcomes = [];

    for (const file of pending) {
      const fileName = file.name;
      try {
        const duplicateId = findDuplicateSourceId(fileName);
        let outcome = null;

        if (!duplicateId) {
          outcome = await processSingleFile(file, fileName, profile);
        } else {
          // Ask only with the body text in place: without it the user would pick
          // an action without seeing which file it affects.
          if (!showDuplicatePrompt(fileName)) {
            const err = new Error(promptUnavailableMessage(fileName));
            err[DUPLICATE_PROMPT_FLAG] = true;
            throw err;
          }
          const action = await waitForDuplicateResolution();
          if (action === 'overwrite') {
            outcome = await processSingleFile(file, fileName, profile, {
              replaceSourceId: duplicateId,
            });
          } else if (action === 'keep') {
            const existingNames = [...state.sourceFiles.values()].map((source) => source.name);
            const newName = createUniqueSourceName(fileName, existingNames);
            outcome = await processSingleFile(file, newName, profile);
          }
          // 'cancel' imports nothing and reports nothing: that is the user's call.
        }

        if (outcome) {
          outcomes.push(outcome);
          if (outcome.status === 'imported') committed += 1;
        }
      } catch (err) {
        console.error(`檔案匯入失敗 (${fileName}):`, err);
        if (committed > 0) {
          await rollbackBatch(batchSnapshot, fileName);
        } else {
          showToast(err[DUPLICATE_PROMPT_FLAG] ? err.message : '檔案匯入失敗，請稍後再試');
        }
        // Unexpected failures are fail-closed for the rest of the batch: nothing
        // after this point is attempted behind a toast nobody can act on.
        return;
      }
    }

    if (outcomes.length === 1) {
      // Single-file imports keep the verbatim per-file message; the summary
      // only exists for batches.
      showToast(outcomes[0].message);
    } else if (outcomes.length > 1) {
      showToast(buildBatchSummary(outcomes));
    }
    // Zero outcomes means every file was user-cancelled: report nothing.
  } catch (err) {
    console.error('檔案匯入失敗:', err);
    showToast(err[DUPLICATE_PROMPT_FLAG] ? err.message : '檔案匯入失敗，請稍後再試');
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

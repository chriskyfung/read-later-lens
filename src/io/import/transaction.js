/**
 * @fileoverview Import transaction core — snapshot, staging commit, persist
 * and rollback.
 *
 * Extracted from src/io/importer.js. This is the only module that mutates the
 * live `state` for an import: parse & validate into staging → commit to the
 * working set → persist. A handled failure restores a snapshot captured before
 * the file was processed, so a failed write rewinds the purge and the merge
 * together.
 */

import * as state from '../../core/state';
import { STALE_STATE_REASON } from '../../core/guard.js';
import { showToast } from '../../utils/dom';
import { deps } from './deps.js';
import { buildImportedMessage } from './messages.js';
import {
  CONFLICT_FLAG,
  EMPTY_OVERWRITE_FLAG,
  PERSIST_FAILED_FLAG,
  UNSUPPORTED_SOURCE_FLAG,
  UNSUPPORTED_TYPE_FLAG,
} from './constants.js';
import { prepareSingleFile } from './parsing.js';

/**
 * Capture a complete snapshot of in-memory state that an import or overwrite
 * could mutate, so failed writes or rollbacks can rewind deterministically.
 *
 * @returns {{sourceFiles: Map, bookmarks: object[], selectedIds: Set, activeFolder: string}}
 */
export function captureImportSnapshot() {
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
export async function processSingleFile(file, finalName, profile, options = {}) {
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
 * @param {import('../../model/BookmarkRecord.js').BookmarkRecord[]} newBookmarks
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
export async function rollbackBatch(snapshot, fileName) {
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

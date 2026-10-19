/**
 * @fileoverview Import batch orchestration — preflight, per-file dispatch,
 * duplicate resolution and the single batch toast.
 *
 * Extracted from src/io/importer.js. Coordinates the duplicate prompt
 * (duplicates.js) with the transaction core (transaction.js) and reports the
 * batch outcome through one toast, because the single `#toastMsg` element is
 * last-write-wins.
 */

import * as state from '../../core/state.js';
import { normalizeProfileId } from '../../providers/profiles.js';
import { showToast } from '../../utils/dom.js';
import { buildBatchSummary, createUniqueSourceName, promptUnavailableMessage } from './messages.js';
import {
  DUPLICATE_PROMPT_FLAG,
  duplicatePromptReady,
  findDuplicateSourceId,
  showDuplicatePrompt,
  waitForDuplicateResolution,
} from './duplicates.js';
import { selectedProfileId } from './picker.js';
import { captureImportSnapshot, processSingleFile, rollbackBatch } from './transaction.js';

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

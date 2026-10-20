/**
 * @fileoverview Pure import message and name builders.
 *
 * Zero state, zero DOM: format-only helpers extracted from
 * src/io/importer.js so batch.js and transaction.js can compose toasts
 * without reaching back into the importer's internals.
 */

/** Maximum failed files named before the summary collapses to a count.
 * Successful files are always counts; only failures are actionable, and only
 * the first few fit a 2.5s single-line toast. */
export const MAX_NAMED_BATCH_FAILURES = 3;

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
 * Refusal copy for an unusable duplicate prompt. Used by the batch preflight
 * and by a mid-batch escape where nothing has been committed yet — both cases
 * where "not a single file was imported" is literally true.
 *
 * @param {string} names Colliding file name(s), already formatted.
 * @returns {string}
 */
export function promptUnavailableMessage(names) {
  return `無法顯示同名檔案的處理選項，因此未匯入任何檔案（${names}）。請重新載入頁面後再試。`;
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
 * @param {number} [droppedNoUrl] URL-less rows the adapter dropped (its own
 *   count, not a length delta, so the reason is intrinsic to the number).
 * @param {string} [note]     Optional sanity-check warning to append.
 * @returns {string}
 */
export function buildImportedMessage(
  finalName,
  displaced,
  count,
  skipped,
  droppedNoUrl = 0,
  note = '',
) {
  const parts = [];
  if (skipped > 0) parts.push(`${skipped} 列解析失敗`);
  if (droppedNoUrl > 0) parts.push(`${droppedNoUrl} 筆缺少網址`);

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

/**
 * Compose one toast for a multi-file batch whose per-file outcomes were
 * collected by handleFileUploads. Successes aggregate into counts; failures
 * are named with their short reason so no file's result vanishes behind the
 * single `#toastMsg` element.
 *
 * @param {Array<object>} outcomes Per-file results, excluding user-cancelled
 *   duplicates.
 * @returns {string}
 */
export function buildBatchSummary(outcomes) {
  const imported = outcomes.filter((outcome) => outcome.status === 'imported');
  const failed = outcomes.filter((outcome) => outcome.status === 'failed');
  const totalBookmarks = imported.reduce((sum, outcome) => sum + outcome.count, 0);
  const skippedParseRows = imported.reduce((sum, outcome) => sum + outcome.skipped, 0);
  const droppedNoUrl = imported.reduce((sum, outcome) => sum + outcome.droppedNoUrl, 0);
  const displaced = imported.reduce((sum, outcome) => sum + outcome.displaced, 0);

  const gaps = [];
  if (skippedParseRows > 0) gaps.push(`共 ${skippedParseRows} 列解析失敗`);
  if (droppedNoUrl > 0) gaps.push(`共 ${droppedNoUrl} 筆缺少網址`);

  const failedNames = failed
    .slice(0, MAX_NAMED_BATCH_FAILURES)
    .map((outcome) => `${outcome.finalName}（${outcome.reason}）`)
    .join('、');
  const failedClause =
    failed.length > MAX_NAMED_BATCH_FAILURES
      ? `${failed.length} 個檔案失敗：${failedNames}、等 ${failed.length} 個檔案`
      : `${failed.length} 個檔案失敗：${failedNames}`;

  if (imported.length === 0) {
    return `${failed.length} 個檔案均匯入失敗：${failedNames}${
      failed.length > MAX_NAMED_BATCH_FAILURES ? `、等 ${failed.length} 個檔案` : ''
    }`;
  }

  let message = `已成功載入 ${imported.length} 個檔案（共 ${totalBookmarks} 筆書籤`;
  if (gaps.length > 0) message += `，${gaps.join('、')}已略過`;
  if (displaced > 0) message += `，${displaced} 筆已存在於回收桶的書籤已被新匯入資料取代`;
  message += '）';
  if (failed.length > 0) message += `；${failedClause}`;
  return message;
}

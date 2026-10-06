/**
 * @fileoverview Download helpers - Blob download, plus File System Access API
 * write with a safe download fallback.
 *
 * One save-back pipeline for every source type and every browser: prompt with
 * `showSaveFilePicker` where the browser has one, otherwise fall back to a
 * plain download. A user-cancelled picker (AbortError) aborts silently.
 */

import { showToast } from './dom.js';

/**
 * Grace period before releasing a download's object URL.
 *
 * Revoking in the same task as `click()` is the pattern Mozilla bug 1282407
 * showed can end a download before it starts (fixed in Firefox 50, and the
 * spec says the synchronous form should work, so this is hardening rather
 * than a repair of a reproducible defect). Bug 2005952 is still open for
 * the neighbouring case where a download outlives its context.
 *
 * One second is not a measured requirement; it clears any sensible
 * initiation boundary and sits inside Firefox's own 5s retained-revoked-URL
 * window (bug 1420419). Deliberately not FileSaver.js's 40s: a `.db` export
 * is a snapshot of the whole database already resident in memory, so 40s
 * would pin that blob 40x longer for no demonstrable gain.
 */
const REVOKE_DELAY_MS = 1000;

/**
 * Trigger a browser download of a Blob.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  // Armed before the click, so a click that throws cannot strand the URL for
  // the lifetime of the page.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  a.click();
  document.body.removeChild(a);
  showToast(`已開始下載檔案: ${filename}`);
}

/**
 * Save a copy of a file: prompt with the File System Access API's Save-As
 * picker where the browser has one (Chromium), otherwise fall back to a plain
 * download (Firefox/Safari). A user-cancelled picker (AbortError) aborts
 * silently.
 *
 * @param {string} data
 * @param {string} filename
 * @param {string} mimeType
 * @returns {Promise<void>}
 */
export async function saveFileWithFallback(data, filename, mimeType) {
  // 1) The monolith's Save-As picker, then a plain download.
  if ('showSaveFilePicker' in window) {
    try {
      const picked = await window.showSaveFilePicker({ suggestedName: filename });
      const writable = await picked.createWritable();
      await writable.write(data);
      await writable.close();
      showToast(`已成功寫入檔案: ${filename}`);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('File System Access API failed or cancelled, falling back to download:', err);
    }
  }

  const blob = new Blob([data], { type: mimeType });
  downloadBlob(blob, filename);
}

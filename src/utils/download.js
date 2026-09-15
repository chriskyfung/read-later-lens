/**
 * @fileoverview Download helpers - Blob download, plus File System Access API
 * write with a safe download fallback.
 *
 * Behaviour mirrors the original monolith exactly: prefer an existing handle,
 * otherwise prompt with `showSaveFilePicker`, otherwise fall back to a plain
 * download. A user-cancelled picker (AbortError) aborts silently.
 */

import { showToast } from './dom.js';

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
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`已開始下載檔案: ${filename}`);
}

/**
 * Try to write a file directly via the File System Access API; fall back to a
 * download if the handle/gesture/browser doesn't support it.
 *
 * @param {string} data
 * @param {string} filename
 * @param {string} mimeType
 * @param {FileSystemFileHandle} [handle] Optional existing handle to overwrite.
 * @returns {Promise<void>}
 */
export async function saveFileWithFallback(data, filename, mimeType, handle) {
  // 1) Prefer an existing handle (e.g. from drag-and-drop).
  if (handle && typeof handle.createWritable === 'function') {
    try {
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      showToast(`已成功寫入檔案: ${filename}`);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('File System Access write failed, falling back to download:', err);
    }
  }

  // 2) Fall back to the monolith's Save-As picker, then a plain download.
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

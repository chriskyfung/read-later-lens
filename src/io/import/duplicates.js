/**
 * @fileoverview Duplicate-filename prompt for the import batch.
 *
 * Extracted from src/io/importer.js. The prompt sits outside the layer
 * stack, so every control it touches is load-bearing: without them the
 * question cannot be answered and the batch would wait for a reply that can
 * never arrive.
 */

import * as state from '../../core/state.js';

/** Marker property read by handleFileUploads to distinguish a
 * duplicate-prompt-unavailable failure from other import errors. */
export const DUPLICATE_PROMPT_FLAG = 'duplicatePromptUnavailable';

/** Node ids the duplicate prompt needs before a user can answer it. */
export const DUPLICATE_PROMPT_IDS = [
  'duplicateModal',
  'duplicateFileText',
  'dupBtnOverwrite',
  'dupBtnKeepBoth',
  'dupBtnCancel',
];

/**
 * @returns {boolean} Whether the duplicate prompt can be shown and answered.
 */
export function duplicatePromptReady() {
  return DUPLICATE_PROMPT_IDS.every((id) => document.getElementById(id));
}

/**
 * Render the duplicate prompt's body text.
 *
 * @param {string} fileName
 * @returns {boolean} false when the prompt body is missing; the caller must
 *   not ask the question then, or the user would be choosing blind.
 */
export function showDuplicatePrompt(fileName) {
  const text = document.getElementById('duplicateFileText');
  if (!text) {
    console.warn('Duplicate prompt body is missing:', fileName);
    return false;
  }
  text.innerText = `已存在名為「${fileName}」的檔案。請選擇要如何處理？`;
  return true;
}

/**
 * @param {string} fileName
 * @returns {string|null} Id of the registered source with this exact name.
 */
export function findDuplicateSourceId(fileName) {
  for (const [id, source] of state.sourceFiles.entries()) {
    if (source.name === fileName) return id;
  }
  return null;
}

/**
 * Logic for resolving duplicate filename conflicts via a modal promise.
 *
 * @returns {Promise<'overwrite' | 'keep' | 'cancel'>}
 */
export function waitForDuplicateResolution() {
  return new Promise((resolve, reject) => {
    const modal = document.getElementById('duplicateModal');
    const btnOverwrite = document.getElementById('dupBtnOverwrite');
    const btnKeep = document.getElementById('dupBtnKeepBoth');
    const btnCancel = document.getElementById('dupBtnCancel');

    // Defence-in-depth: the batch preflight verifies these nodes before any
    // state is mutated, but the markup can still change between files. A
    // half-wired modal must neither throw inside this executor (which would
    // reject the awaiting batch with a raw TypeError) nor leave the batch
    // waiting for a reply no remaining button can give.
    if (!modal || !btnOverwrite || !btnKeep || !btnCancel) {
      const err = new Error('無法顯示同名檔案的處理選項');
      err[DUPLICATE_PROMPT_FLAG] = true;
      reject(err);
      return;
    }

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

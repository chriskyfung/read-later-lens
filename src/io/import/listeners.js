/**
 * @fileoverview Import DOM listener wiring — header button, source picker and
 * the hidden file input.
 *
 * Extracted from src/io/importer.js. The layer registration lives in
 * src/views/modalListeners.js; only the import-specific listeners live here.
 */

import { selectableProfiles } from '../../providers/profiles.js';
import { showToast } from '../../utils/dom';
import {
  applyProfileSelection,
  cardEl,
  closeImportModal,
  handleProfileKeydown,
  openImportModal,
  selectedProfileId,
} from './picker.js';
import { handleFileUploads } from './batch.js';

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

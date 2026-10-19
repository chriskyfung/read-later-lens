/**
 * @fileoverview Import source picker modal — session selection + layer stack.
 *
 * Extracted from src/io/importer.js. Presentational markup stays in
 * src/components/io/importModal.js; open/close and radio-card keyboard
 * behaviour live here. The layer registration lives in src/views/modalListeners.js.
 */

import {
  defaultProfileId,
  normalizeProfileId,
  selectableProfiles,
} from '../../providers/profiles.js';
import { SELECTED_CARD_CLASSES, UNSELECTED_CARD_CLASSES } from '../../components/io/importModal.js';
import { pushLayer, popLayer, topLayerId } from '../../utils/dom.js';

/** Currently selected source profile id (session-only; defaults to InstapaperScraper). */
export let selectedProfileId = defaultProfileId();

/**
 * @param {string} profileId
 * @returns {HTMLElement|null} The profile's radio card element.
 */
export function cardEl(profileId) {
  return document.getElementById(`importProfile-${profileId}`);
}

/**
 * Select a source profile: remember it and sync the radio cards' aria state
 * and selected/unselected border classes. Exported so tests (and the modal
 * opener) can reset the session default deterministically. Unknown ids
 * coerce to the default, so the radiogroup keeps exactly one checked card.
 *
 * @param {string} profileId
 */
export function applyProfileSelection(profileId) {
  selectedProfileId = normalizeProfileId(profileId);
  for (const { id } of selectableProfiles()) {
    const card = cardEl(id);
    if (!card || !card.classList) continue;
    // Compare against the coerced selection, not the raw input: an unknown
    // id must still leave exactly one card checked instead of zero.
    card.setAttribute?.('aria-checked', String(id === selectedProfileId));
    const checked = id === selectedProfileId;
    for (const name of checked ? UNSELECTED_CARD_CLASSES : SELECTED_CARD_CLASSES) {
      card.classList.remove(name);
    }
    for (const name of checked ? SELECTED_CARD_CLASSES : UNSELECTED_CARD_CLASSES) {
      card.classList.add(name);
    }
  }
}

/**
 * Open the source picker modal as a stack layer (Esc, focus trap and inert
 * background come from the shared layer stack). Re-entrant clicks are no-ops.
 */
export function openImportModal() {
  if (topLayerId() === 'importModal') return;
  applyProfileSelection(selectedProfileId);
  pushLayer('importModal');
}

/** Close the source picker, revealing whatever modal (if any) is beneath it. */
export function closeImportModal() {
  popLayer('importModal');
}

/**
 * Arrow/Home/End navigation within the radiogroup (Enter/Space already fire
 * click natively on the card buttons). Wraps around both ends.
 *
 * @param {KeyboardEvent} event
 */
export function handleProfileKeydown(event) {
  const list = selectableProfiles();
  const idx = list.findIndex((profile) => profile.id === selectedProfileId);
  let next = null;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    next = list[(idx + 1) % list.length];
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    next = list[(idx - 1 + list.length) % list.length];
  } else if (event.key === 'Home') {
    next = list[0];
  } else if (event.key === 'End') {
    next = list[list.length - 1];
  }
  if (!next) return;
  event.preventDefault?.();
  applyProfileSelection(next.id);
  const card = cardEl(next.id);
  if (card && typeof card.focus === 'function') card.focus();
}

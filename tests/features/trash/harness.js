// Shared test harness for trash feature — extracted from the 4 former flat
// `views-trash-*.test.js` files so each colocated or cross-module test gets
// the same factories, constants, and beforeEach setup with a single source of truth.

import { beforeEach, vi } from 'vitest';

/**
 * Timestamps used across all trash tests.
 */
export const OLDER = '2026-01-01T00:00:00.000Z';
export const NEWER = '2026-02-01T00:00:00.000Z';

/**
 * Build a trashed bookmark record.
 * @param {string} id
 * @param {string} title
 * @param {string} [deletedAt=OLDER] ISO timestamp or omitted for OLDER default
 */
export function trashed(id, title, deletedAt = OLDER) {
  return {
    id,
    title,
    article_preview: `${title} preview`,
    source_file_name: 'instapaper.csv',
    deleted_at: deletedAt,
  };
}

/**
 * Build a live (non-trashed) bookmark record.
 * @param {string} id
 * @param {string} title
 */
export function live(id, title) {
  return { id, title, article_preview: `${title} preview` };
}

/**
 * Shared beforeEach harness for trash tests.
 *
 * Resets the stale-gate flag and stubs `confirm` so each test starts fresh.
 * The caller must have declared `const gate = vi.hoisted(() => ({ fresh }))`
 * at the top of their module; this function merely resets `gate.fresh`.
 *
 * @param {object} [options] - Configuration options.
 * @param {boolean} [options.fresh=true] - Value to reset `gate.fresh` to.
 * @param {Function} [options.onBeforeEach] - Hook running after the default
 *   setup, for test-specific DOM (document.body innerHTML) configuration.
 * @param {object} [gate] - The gate object from `vi.hoisted()`. If omitted,
 *   the function assumes the module-level `gate` variable exists.
 */
export function setupTrash(options = {}, gate) {
  const { fresh = true, onBeforeEach: userBeforeEach } = options;

  // Use the provided gate or fall back to the module-level one.
  const g = gate !== undefined ? gate : globalThis.__trashGate || globalThis.gate;

  beforeEach(() => {
    // Reset the stale-gate flag so the tab is always "fresh" by default.
    if (g) g.fresh = fresh;

    // Clear per-test state (els map kept by the stub DOM).
    for (const k of Object.keys(globalThis.__trashEls || {})) delete globalThis.__trashEls[k];

    // Confirm stub — default true; tests can override afterward.
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );

    // User hook for test‑specific DOM setup (document.body innerHTML etc.).
    if (typeof userBeforeEach === 'function') userBeforeEach();
  });
}

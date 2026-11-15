import { createIcons } from 'lucide';

/**
 * @fileoverview Shared Lucide icon initialization utility.
 *
 * Provides a centralized way to initialize/re-initialize Lucide icons after
 * DOM elements with [data-lucide] attributes are mounted. Designed to be
 * called after any render/mount cycle that inserts new icon placeholders,
 * keeping icon registration logic out of feature-specific modules.
 */

/**
 * Initialize Lucide icons with the provided icon map.
 *
 * Call this AFTER any elements with [data-lucide] are inserted into the DOM,
 * otherwise they stay as inert <i> placeholders.
 *
 * @param {Record<string, any>} icons - Map of icon name → Lucide icon component
 * @param {Element|Document} [root=document] - Root element to search within
 */
export function initializeLucideIcons(icons, root = document) {
  if (!Object.values(icons).length) return;
  createIcons({ icons, root });
}

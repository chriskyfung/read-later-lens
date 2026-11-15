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
 *
 * @example
 * // Boot-time: initialize all app icons after mounts
 * import { initializeLucideIcons } from '@/utils/lucide.js';
 * import { CircleQuestionMark, GraphStar } from 'lucide';
 * initializeLucideIcons({ CircleQuestionMark, GraphStar });
 *
 * @example
 * // Card re-render: only re-initialize GraphStar
 * import { initializeLucideIcons } from '@/utils/lucide.js';
 * import { GraphStar } from 'lucide';
 * initializeLucideIcons({ GraphStar });
 */
export function initializeLucideIcons(icons, root = document) {
  if (!Object.values(icons).length) return;
  createIcons({ icons, root });
}

/**
 * Lazily initialize Lucide icons via dynamic import — defers icon module
 * loading until the first call, improving tree-shaking and boot performance.
 *
 * Call this AFTER any elements with [data-lucide] are inserted into the DOM.
 *
 * @param {string[]} iconNames - Lucide icon export names (e.g. ['CircleQuestionMark', 'GraphStar'])
 * @param {Element|Document} [root=document] - Root element to search within
 * @returns {Promise<void>}
 *
 * @example
 * // Boot-time with deferred loading
 * await lazyInitializeLucideIcons(['CircleQuestionMark', 'GraphStar']);
 *
 * @example
 * // Card re-render with deferred loading
 * await lazyInitializeLucideIcons(['GraphStar']);
 */
export async function lazyInitializeLucideIcons(iconNames, root = document) {
  if (!iconNames.length) return;
  const lucide = await import('lucide');
  const icons = {};
  for (const name of iconNames) {
    const icon = lucide[name];
    if (icon) icons[name] = icon;
  }
  if (!Object.values(icons).length) return;
  createIcons({ icons, root });
}

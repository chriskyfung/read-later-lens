/**
 * @fileoverview Reader queue-button variant classes.
 *
 * Hoisted so every open/toggle reuses the same arrays instead of allocating
 * fresh token lists per call.
 */

export const QUEUE_OFF = [
  'bg-slate-800',
  'hover:bg-amber-100',
  'text-amber-400',
  'border-amber-400/60',
  'hover:border-amber-400',
];
export const QUEUE_ON = [
  'bg-amber-400',
  'hover:bg-amber-300/60',
  'text-amber-50',
  'hover:text-amber-900/60',
  'border-amber-400',
  'hover:border-amber-400',
];
export const QUEUE_ALL = [
  'bg-slate-800',
  'bg-amber-400',
  'hover:bg-amber-100',
  'hover:bg-amber-300/60',
  'text-amber-50',
  'text-amber-400',
  'hover:text-slate-900',
  'hover:text-slate-900/60',
  'hover:text-amber-400',
  'hover:text-amber-900/60',
  'border-amber-400/60',
  'border-amber-400',
  'hover:border-amber-400',
];

/**
 * Apply the on/off variant to the queue button (single remove + add).
 *
 * @param {HTMLElement} queueBtn
 * @param {boolean} isQueud
 */
export function applyQueueVariant(queueBtn, isQueud) {
  queueBtn.classList.remove(...QUEUE_ALL);
  queueBtn.classList.add(...(isQueud ? QUEUE_ON : QUEUE_OFF));
  queueBtn.setAttribute('aria-pressed', String(isQueud));
  queueBtn.title = isQueud ? '移出閱讀佇列' : '加入閱讀佇列';
}

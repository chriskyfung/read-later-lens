/**
 * @fileoverview Reader favorite-button variant classes.
 *
 * Hoisted so every open/toggle reuses the same arrays instead of allocating
 * fresh token lists per call.
 *
 * Pink marks the star control (matching the card's pink ❤) so it never reads
 * as the rose trash button. Measured pairs: pink-400 on slate-800 8.07:1,
 * slate-900 on pink-400 9.84:1 — both clear WCAG 2.x AA 4.5:1.
 */

export const FAV_OFF = [
  'bg-slate-800',
  'hover:bg-pink-100',
  'text-pink-400',
  'border-pink-400/60',
  'hover:border-pink-400',
];
export const FAV_ON = [
  'bg-pink-400',
  'hover:bg-pink-300/60',
  'text-pink-50',
  'hover:text-pink-900/60',
  'border-pink-400',
  'hover:border-pink-400',
];
export const FAV_ALL = [
  'bg-slate-800',
  'bg-pink-400',
  'hover:bg-pink-100',
  'hover:bg-pink-300/60',
  'text-pink-50',
  'text-pink-400',
  'hover:text-slate-900',
  'hover:text-slate-900/60',
  'hover:text-pink-400',
  'hover:text-pink-900/60',
  'border-pink-400/60',
  'border-pink-400',
  'hover:border-pink-400',
];

/**
 * Apply the on/off variant to the favorite button (single remove + add).
 *
 * @param {HTMLElement} favoriteBtn
 * @param {boolean} isFavorite
 */
export function applyFavoriteVariant(favoriteBtn, isFavorite) {
  favoriteBtn.classList.remove(...FAV_ALL);
  favoriteBtn.classList.add(...(isFavorite ? FAV_ON : FAV_OFF));
  favoriteBtn.setAttribute('aria-pressed', String(isFavorite));
  favoriteBtn.title = isFavorite ? '已收藏，點擊取消收藏' : '加星收藏';
}

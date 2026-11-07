/**
 * @fileoverview Header view constants — debounce timing and user-facing copy.
 */

/** Delay (ms) between the last keystroke and applying the search. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Confirmation before wiping the local cache (the only destructive header action). */
export const CLEAR_CACHE_CONFIRM = '確定要清除 IndexedDB 中的本地快取書籤資料嗎？';

/** Toast shown after a successful cache wipe. */
export const CACHE_CLEARED_TOAST = '已成功清空本地快取';

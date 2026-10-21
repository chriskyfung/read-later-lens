/**
 * @fileoverview Workspace view constants — user-facing toast strings.
 *
 * The strings are verbatim from the original monolith; they are only
 * collected here so the action modules do not inline the copy.
 */

export const TRASHED_TOAST = (title) => `已將書籤「${title}」移至回收桶`;
export const FAVORITE_ON_TOAST = (title) => `已將「${title}」設為收藏`;
export const FAVORITE_OFF_TOAST = (title) => `已取消收藏「${title}」`;
export const BATCH_TRASHED_TOAST = (n) => `已將 ${n} 筆書籤移至回收桶`;

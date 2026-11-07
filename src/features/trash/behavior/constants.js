export const TRASH_IDS = {
  list: 'trashList',
  summary: 'trashSummary',
  emptyState: 'trashEmptyState',
  emptyBtn: 'emptyTrashBtn',
  modal: 'trashModal',
};
export const summaryText = (n) => `共 ${n} 筆`;
export const restoreToast = (title) => `已還原書籤「${title}」`;
export const PURGE_TOAST = '已永久刪除該筆書籤';
export const emptyToast = (n) => `已清空回收桶（${n} 筆）`;
export const purgeConfirm = (title) => `確定要永久刪除書籤「${title}」嗎？此動作無法復原。`;
export const emptyConfirm = (n) => `確定要永久刪除回收桶中的 ${n} 筆書籤嗎？此動作無法復原。`;

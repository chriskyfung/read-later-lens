/**
 * @fileoverview Reading queue item row markup — presentational only.
 *
 * Each row represents one queued bookmark. Clicking the row opens the reader
 * modal; a drag handle (grip-vertical) enables drag-and-drop reordering.
 * Action buttons (move top / move bottom / remove) appear on hover.
 */

/**
 * Build a single queue item row.
 *
 * @param {object} opts
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord} opts.bookmark
 * @param {number} opts.index Zero-based position in the queue (1-based display).
 * @param {string} opts.domain Resolved domain badge text.
 * @returns {string}
 */
export function queueItemHtml({ bookmark, index, domain }) {
  const b = bookmark;
  const displayIndex = index + 1;
  return `
    <div class="queue-item bg-slate-700/50 border border-slate-600/50 rounded-xl p-3 flex items-center gap-3 group cursor-pointer hover:bg-slate-700 transition-colors"
      draggable="false"
      data-queue-row="${b.id}"
      data-open-reader="${b.id}"
      aria-roledescription="可拖曳排序項目">
      <!-- Drag handle — the only draggable element, so a drag never starts from
           the row's click-to-open-reader surface. -->
      <span class="drag-handle text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-1 rounded transition-colors shrink-0 select-none"
        data-drag-handle="${b.id}"
        aria-label="拖曳排序"
        tabindex="-1"
        title="拖曳以重新排序"
        draggable="true">
        <i class="size-4" data-lucide="grip-vertical"></i>
      </span>

      <span class="text-xs text-slate-500 font-mono w-6 text-right">${displayIndex}</span>

      <div class="flex-1 min-w-0 flex items-center gap-2">
        <div class="text-[10px] font-bold font-mono uppercase px-1.5 py-0.5 rounded-sm border border-slate-600/50 bg-slate-700 text-slate-300 shrink-0">${b.detected_language || 'EN'}</div>
        <div class="text-[10px] bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded-sm border border-indigo-800/50 truncate max-w-35">${domain}</div>
        <h4 class="font-medium text-slate-100 truncate">${b.title}</h4>
      </div>

      <!-- Action menu (3-dot dropdown) -->
      <div class="relative" data-queue-actions="${b.id}">
        <button class="action-menu-trigger hover:text-slate-400 hover:bg-slate-700 p-1.5 rounded transition-colors"
          aria-label="更多操作" aria-expanded="false" aria-haspopup="true">
          <i class="size-4" data-lucide="ellipsis"></i>
        </button>
        <div class="action-menu absolute right-0 top-full mt-1 min-w-30 bg-slate-800 border border-slate-700 rounded-lg shadow-lg opacity-0 invisible transform translate-y-1 transition-all duration-150 z-10" role="menu">
          <button class="move-top-btn w-full text-left px-3 py-2 text-xs hover:bg-slate-700 flex items-center gap-2"
            data-move-top="${b.id}" role="menuitem"
            title="移至最上層">
            <i class="size-3.5" data-lucide="list-start"></i> 移至最上層
          </button>
          <button class="move-bottom-btn w-full text-left px-3 py-2 text-xs hover:bg-slate-700 flex items-center gap-2"
            data-move-bottom="${b.id}" role="menuitem"
            title="移至最下層">
            <i class="size-3.5" data-lucide="list-end"></i> 移至最下層
          </button>
          <hr class="border-slate-700 my-1">
          <button class="remove-queue-btn w-full text-left px-3 py-2 text-xs hover:bg-rose-900/30 text-rose-300 flex items-center gap-2"
            data-remove-queue="${b.id}" role="menuitem"
            title="移出佇列">
            <i class="size-3.5" data-lucide="list-x"></i> 移出佇列
          </button>
        </div>
      </div>
    </div>
  `;
}

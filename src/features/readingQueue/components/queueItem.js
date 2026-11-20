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
      draggable="true"
      data-queue-row="${b.id}"
      data-open-reader="${b.id}"
      aria-roledescription="可拖曳排序項目">
      <!-- Drag handle -->
      <span class="drag-handle text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-1 rounded transition-colors flex-shrink-0 select-none"
        data-drag-handle="${b.id}"
        aria-label="拖曳排序"
        tabindex="-1"
        title="拖曳以重新排序"
        draggable="false">
        <i class="size-4" data-lucide="grip-vertical"></i>
      </span>

      <span class="text-xs text-slate-500 font-mono w-6 text-right">${displayIndex}</span>

      <div class="flex-1 min-w-0 flex items-center gap-2">
        <div class="text-[10px] font-bold font-mono uppercase px-1.5 py-0.5 rounded-sm border border-slate-600/50 bg-slate-700 text-slate-300 shrink-0">${b.detected_language || 'EN'}</div>
        <div class="text-[10px] bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded-sm border border-indigo-800/50 truncate max-w-35">${domain}</div>
        <h4 class="font-medium text-slate-100 truncate">${b.title}</h4>
      </div>

      <!-- Hover actions -->
      <div class="flex items-center gap-1.5 shrink-0">
        <button class="move-top-btn hover:text-sky-300 flex items-center gap-1 px-2 py-1 rounded-sm transition text-xs"
          data-move-top="${b.id}"
          title="移至最上層">
          <i class="size-4" data-lucide="list-start"></i>
        </button>
        <button class="move-bottom-btn hover:text-sky-300 flex items-center gap-1 px-2 py-1 rounded-sm transition text-xs"
          data-move-bottom="${b.id}"
          title="移至最下層">
          <i class="size-4" data-lucide="list-end"></i>
        </button>
        <button class="remove-queue-btn hover:text-rose-300 flex items-center gap-1 px-2 py-1 rounded-sm transition text-xs"
          data-remove-queue="${b.id}"
          title="移出佇列">
          <i class="size-4" data-lucide="list-x"></i>
        </button>
      </div>
    </div>
  `;
}

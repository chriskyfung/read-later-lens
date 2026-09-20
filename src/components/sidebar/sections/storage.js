/**
 * @fileoverview Sidebar IndexedDB storage-usage section markup.
 *
 * Static monolith parity: extracted byte-for-byte from the original
 * src/components/sidebar.js sidebarHtml() template (index.html "Left Sidebar").
 * The values are refreshed by src/views/sidebarActions.js (updateStorageUsageUI).
 */

/** @returns {string} The storage usage section markup. */
export function sidebarStorageSectionHtml() {
  return `      <!-- IndexedDB Storage Info -->
      <div class="pt-4 border-t border-slate-700/60 mt-auto">
        <div class="text-[11px] text-slate-400 flex justify-between mb-1">
          <span>快取儲存空間</span>
          <span id="storageUsageText">0 KB / 50MB</span>
        </div>
        <div class="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div id="storageProgressBar" class="bg-indigo-500 h-full w-0 transition-all duration-300"></div>
        </div>
      </div>`;
}
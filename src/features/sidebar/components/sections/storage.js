/**
 * @fileoverview Sidebar IndexedDB storage-usage section markup.
 *
 * The storage-usage section markup is preserved from the monolith;
 * Tailwind classes and DOM hooks match the original byte-for-byte. The values
 * are refreshed by ../behavior/storage.js (updateStorageUsageUI).
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

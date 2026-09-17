/**
 * @fileoverview Notification toast — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html toast block).
 * Behavior lives in src/utils/dom.js (showToast).
 */

/** @returns {string} The toast markup. */
export function toastHtml() {
  return `
  <!-- Notification Toast Modal -->
  <div id="toastNotification"
    class="fixed bottom-5 right-5 z-50 transform translate-y-20 opacity-0 transition-all duration-300 pointer-events-none bg-indigo-600 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2">
    <span id="toastMsg">通知訊息</span>
  </div>
`;
}

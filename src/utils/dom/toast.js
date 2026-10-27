/**
 * @fileoverview Toast notifications.
 *
 * Shows a transient message for 2.5s. The hide timer is stored as an expando
 * on the toast node (`_hideTimer`) so a repeat call resets it rather than
 * stacking timers; this is the only module-global side effect in
 * src/utils/dom.
 *
 * Re-exported by the public barrel src/utils/dom/index.js.
 */

const TOAST_HIDE_MS = 2500;

/**
 * Show a toast notification for 2.5s.
 *
 * @param {string} message
 */
export function showToast(message) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMsg');
  if (!toast || !msgEl) return;
  msgEl.innerText = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, TOAST_HIDE_MS);
}

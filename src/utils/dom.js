/**
 * @fileoverview Tiny DOM helpers so views don't sprinkle boilerplate everywhere.
 */

/**
 * Escape a string for safe insertion into `innerHTML` contexts.
 * Prefer `textContent` / `innerText` where possible.
 *
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Resolve a string into a safe absolute http(s) URL for use in `href`
 * attributes / properties.
 *
 * This is NOT HTML-escaping (use `escapeHtml` for that): it prevents the
 * `javascript:` / `data:` URL scheme attacks that survive attribute escaping
 * when a URL is assigned to an `href`. Returns the normalized `href` for valid
 * http(s) URLs, or `''` for anything else so the caller can fall back to a
 * safe placeholder (e.g. `'#'`).
 *
 * @param {string|null|undefined} url
 * @returns {string}  Safe http(s) URL string, or '' if unsafe/unparseable.
 */
export function safeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

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
  }, 2500);
}

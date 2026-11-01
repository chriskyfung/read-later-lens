/**
 * @fileoverview Storage-usage estimate for the UI meter.
 *
 * Leaf module: it touches no database and no shared state.
 */

/**
 * Estimate storage usage for the UI meter.
 *
 * @returns {Promise<{ usageKB: number, limitMB: number }>}
 */
export async function getStorageUsage() {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return { usageKB: 0, limitMB: 50 };
  }
  const estimate = await navigator.storage.estimate();
  const usageKB = Math.round((estimate.usage || 0) / 1024);
  const limitMB = 50;
  return { usageKB, limitMB };
}

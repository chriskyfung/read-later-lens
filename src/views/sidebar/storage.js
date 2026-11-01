/**
 * @fileoverview Sidebar storage-usage indicator.
 *
 * Extracted from src/views/sidebarActions.js `updateStorageUsageUI()` when the
 * sidebar split into src/views/sidebar/*. The markup lives in
 * src/components/sidebar/sections/storage.js.
 */

import { getStorageUsage } from '../../core/persistence';
import { SIDEBAR_IDS } from './constants.js';

/**
 * Refresh the storage usage indicator in the sidebar.
 */
export async function updateStorageUsageUI() {
  const { usageKB, limitMB } = await getStorageUsage();
  document.getElementById(SIDEBAR_IDS.storageUsageText).innerText = `${usageKB} KB / ${limitMB} MB`;
  const pct = Math.min(100, (usageKB / (limitMB * 1024)) * 100);
  document.getElementById(SIDEBAR_IDS.storageProgressBar).style.width = `${pct}%`;
}

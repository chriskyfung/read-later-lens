/**
 * @fileoverview Import source picker modal — presentational markup only.
 *
 * Sits between the header 匯入 button and the native file picker: the user
 * picks an explicit source profile, then 選擇檔案… opens #fileInput. There is
 * deliberately no auto-detect card (see src/providers/profiles.js). The
 * official-CSV footnote explains why that format is not offered. Behavior
 * lives in src/io/importer.js (open/close, radiogroup keyboard, file input);
 * the layer registration lives in src/views/modalListeners.js.
 */

import { IMPORT_PROFILES, selectableProfiles } from '../providers/profiles.js';

/** Radio-card classes for the selected state (toggled at runtime by src/io/importer.js). */
export const SELECTED_CARD_CLASSES = ['border-indigo-500', 'bg-indigo-600/20'];

/** Radio-card classes for the unselected state (toggled at runtime by src/io/importer.js). */
export const UNSELECTED_CARD_CLASSES = [
  'border-slate-700',
  'bg-slate-900/60',
  'hover:border-slate-500',
];

/** Base classes shared by every source card (colors live in the state lists). */
const CARD_BASE_CLASSES =
  'source-card w-full text-left px-4 py-3 rounded-xl border transition-colors';

/**
 * A selectable source-profile radio button.
 *
 * @param {import('../providers/profiles.js').ImportProfile} profile
 * @returns {string}
 */
function selectableCardHtml(profile) {
  const selected = Boolean(profile.isDefault);
  const state = selected ? SELECTED_CARD_CLASSES : UNSELECTED_CARD_CLASSES;
  return `
        <button type="button" role="radio" aria-checked="${selected}" id="importProfile-${profile.id}"
          data-profile="${profile.id}"
          class="${CARD_BASE_CLASSES} ${state.join(' ')}">
          <span class="block text-sm font-semibold text-white">${profile.label}</span>
          <span class="block text-xs text-slate-400 mt-0.5">${profile.detail} · ${profile.formats.join(' / ')}</span>
        </button>`;
}

/**
 * A disabled roadmap placeholder (rendered outside the radiogroup so the
 * group only ever contains radios; native `disabled` keeps it out of the
 * focus trap).
 *
 * @param {import('../providers/profiles.js').ImportProfile} profile
 * @returns {string}
 */
function disabledCardHtml(profile) {
  return `
      <button type="button" disabled
        class="w-full text-left px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-900/40 opacity-60 cursor-not-allowed">
        <span class="block text-sm font-semibold text-slate-400">${profile.label}</span>
        <span class="block text-xs text-slate-500 mt-0.5">${profile.detail}</span>
      </button>`;
}

/** @returns {string} The import source picker modal markup. */
export function importModalHtml() {
  const cards = selectableProfiles().map(selectableCardHtml).join('');
  const roadmap = IMPORT_PROFILES.filter((profile) => profile.disabled)
    .map(disabledCardHtml)
    .join('');
  return `
  <!-- MODAL 5: Import Source Picker Modal -->
  <div id="importModal"
    class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    role="dialog" aria-modal="true" aria-labelledby="importTitle" tabindex="-1">
    <div class="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5">
      <div class="flex justify-between items-center border-b border-slate-700 pb-3">
        <h3 id="importTitle" class="font-bold text-base text-white">📥 選擇匯入來源</h3>
        <button id="closeImportBtn" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <p class="text-xs text-slate-400 leading-relaxed">選擇資料來源類型，接著選擇要匯入的檔案（可多選）：</p>

      <div id="importSourceGroup" role="radiogroup" aria-labelledby="importTitle" class="space-y-2">
        ${cards}
      </div>
      ${roadmap}

      <p class="text-[11px] text-slate-500 leading-relaxed border-t border-slate-700 pt-3">
        ℹ️ 官方 Instapaper CSV 匯出（URL/Title/…）僅含連結、無預覽內容，不在此支援；請改用 InstapaperScraper 匯出以取得完整資料。
      </p>

      <div class="pt-1 flex justify-end space-x-2">
        <button id="importCancelBtn"
          class="bg-slate-700 hover:bg-slate-600 text-xs text-white px-3 py-2 rounded-lg transition">取消</button>
        <button id="importPickFileBtn"
          class="bg-indigo-600 hover:bg-indigo-500 text-xs text-white px-3 py-2 rounded-lg font-semibold transition">選擇檔案…</button>
      </div>
    </div>
  </div>
`;
}

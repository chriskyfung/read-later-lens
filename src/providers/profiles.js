/**
 * @fileoverview Import source profiles — declarative descriptors for the
 * source-type picker modal (src/components/importModal.js).
 *
 * The app deliberately has NO auto-detection: the user picks an explicit
 * source type (InstapaperScraper preselected), and the header sanity check
 * (checkImport) only *warns* when a file clearly disagrees with the chosen
 * profile. The official Instapaper account CSV (URL,Title,Selection,Folder,
 * Timestamp,Tags — links only, no id/preview) is intentionally NOT a profile:
 * it is too thin to be useful and is rejected with guidance instead.
 */

/**
 * @typedef {object} ImportProfile
 * @property {string} id           Stable profile key (persisted as SourceFileRecord.profile).
 * @property {string} label        zh-TW card title.
 * @property {string} detail       zh-TW one-line description.
 * @property {string[]} formats    Human-readable accepted formats.
 * @property {boolean} [isDefault] Pre-selected card when the modal opens.
 * @property {boolean} [disabled]  Roadmap placeholder — not selectable.
 */

/** @type {ImportProfile[]} */
export const IMPORT_PROFILES = [
  {
    id: 'instapaper-scraper',
    label: 'InstapaperScraper 匯出',
    detail: '標題、網址、文章預覽（Instapaper 書籤）',
    formats: ['CSV', 'JSON', 'SQLite'],
    isDefault: true,
  },
  {
    id: 'rll-unified',
    label: 'Read Later Lens 統一匯出',
    detail: '本應用程式匯出，完整欄位還原',
    formats: ['CSV', 'JSON', 'SQLite'],
  },
  {
    id: 'more-sources',
    label: 'Raindrop / Pocket …',
    detail: '更多資料來源即將推出',
    formats: [],
    disabled: true,
  },
];

/**
 * Profiles the user can actually select (disabled roadmap cards excluded).
 *
 * @returns {ImportProfile[]}
 */
export function selectableProfiles() {
  return IMPORT_PROFILES.filter((profile) => !profile.disabled);
}

/**
 * @returns {string} Profile id preselected when the modal opens.
 */
export function defaultProfileId() {
  return IMPORT_PROFILES.find((profile) => profile.isDefault)?.id ?? selectableProfiles()[0].id;
}

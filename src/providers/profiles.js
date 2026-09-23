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

/**
 * @param {string} profileId
 * @returns {string} zh-TW label for messages (falls back to the raw id).
 */
export function profileLabel(profileId) {
  return IMPORT_PROFILES.find((profile) => profile.id === profileId)?.label ?? profileId;
}

/** zh-TW guidance shown when the official Instapaper account CSV is imported. */
export const OFFICIAL_CSV_UNSUPPORTED_MESSAGE =
  '此為 Instapaper 官方 CSV 匯出（URL/Title/…，僅含連結無預覽），不支援匯入；建議改用 InstapaperScraper 匯出完整資料';

/**
 * Normalize a header list for fingerprinting: trim, strip a leading BOM and
 * lowercase, so `URL` and `url` compare equal.
 *
 * @param {string[]} headers
 * @returns {Set<string>}
 */
function headerSet(headers) {
  return new Set(
    headers.map((header) =>
      String(header)
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase(),
    ),
  );
}

/**
 * Official Instapaper account export: `URL,Title,Selection,Folder,Timestamp,Tags`.
 * Detected only when url + title + timestamp land together with a folder or
 * selection column — none of which ever appear in the supported formats, so a
 * near-miss CSV (url/title/timestamp only) is NOT blocked.
 *
 * @param {Set<string>} headers
 * @returns {boolean}
 */
function isOfficialInstapaperCsv(headers) {
  return (
    headers.has('url') &&
    headers.has('title') &&
    headers.has('timestamp') &&
    (headers.has('folder') || headers.has('selection'))
  );
}

/**
 * Fingerprint a supported file from its column/keys. Returns null when the
 * sample carries no strong marker — unknown files are accepted as-is (the
 * alias-tolerant normalizer plus row validation deal with them).
 *
 * @param {Set<string>} fields Lowercased field names.
 * @returns {'instapaper-scraper'|'rll-unified'|null}
 */
function fingerprint(fields) {
  if (fields.has('source_file_id') || fields.has('detected_language')) return 'rll-unified';
  if (fields.has('id') && fields.has('url')) return 'instapaper-scraper';
  return null;
}

/**
 * Deterministic header sanity check for an already-chosen profile. This is a
 * guard rail, not auto-detection: the user's explicit choice always wins —
 * `mismatch` only appends a warning, while `unsupported` blocks (official
 * Instapaper CSV would otherwise import as rows of garbage).
 *
 * @param {string} profileId Chosen source profile id.
 * @param {object} [sample]
 * @param {string[]} [sample.csvHeaders] CSV header row (any case).
 * @param {string[]} [sample.jsonKeys]  Key list of the first JSON record.
 * @param {object} [sample.jsonRoot]    Parsed JSON root — a versioned
 *   `{ format: 'read-later-lens', … }` envelope is an exact match.
 * @returns {{verdict: 'ok'|'mismatch'|'unsupported', message?: string,
 *   suggestedProfileId?: string}}
 */
export function checkImport(profileId, sample = {}) {
  const { csvHeaders, jsonKeys, jsonRoot } = sample;

  if (csvHeaders && csvHeaders.length > 0) {
    const fields = headerSet(csvHeaders);
    if (isOfficialInstapaperCsv(fields)) {
      return { verdict: 'unsupported', message: OFFICIAL_CSV_UNSUPPORTED_MESSAGE };
    }
    return mismatchVerdict(profileId, fingerprint(fields));
  }

  // Exact fingerprint: the app's own versioned envelope carries its format
  // marker at the root, so recognition never depends on row keys (and works
  // even for an empty bookmark list).
  if (jsonRoot && !Array.isArray(jsonRoot) && jsonRoot.format === 'read-later-lens') {
    return mismatchVerdict(profileId, 'rll-unified');
  }

  if (jsonKeys && jsonKeys.length > 0) {
    return mismatchVerdict(profileId, fingerprint(headerSet(jsonKeys)));
  }

  return { verdict: 'ok' };
}

/**
 * @param {string} profileId Chosen profile.
 * @param {'instapaper-scraper'|'rll-unified'|null} matched Fingerprint result.
 * @returns {{verdict: 'ok'|'mismatch', message?: string, suggestedProfileId?: string}}
 */
function mismatchVerdict(profileId, matched) {
  if (matched && matched !== profileId) {
    return {
      verdict: 'mismatch',
      suggestedProfileId: matched,
      message: `檔案欄位較符合「${profileLabel(matched)}」格式，仍依所選來源匯入`,
    };
  }
  return { verdict: 'ok' };
}

/**
 * @fileoverview Projection of the in-memory source map into persistable rows.
 *
 * Leaf module and pure by construction: it takes the source map as an argument
 * and returns a plain array, so the "what actually gets written to disk"
 * question can be answered by a unit test instead of by reading `saveState()`.
 */

/**
 * Project the live source map into the serializable rows written to the cache.
 *
 * Only serializable source metadata is persisted. Source records carry no
 * file handles — save-back writes a copy (Save-As, then a download), so a
 * handle would have no reader even if one were kept. SQLite payloads stay
 * in memory only.
 *
 * @param {Map<string, object>} sources The live `sourceFiles` map.
 * @returns {object[]} One plain row per source.
 */
export function toPersistedSources(sources) {
  return Array.from(sources.entries()).map(([, v]) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    profile: v.profile,
    originalData: v.type === 'sqlite' || v.type === 'db' ? null : v.originalData,
    // The observed table layout is tiny (a name plus a column list), unlike the
    // payload above, so it IS persisted: without it a reload would make the
    // original `.db` shape unknowable and save-back would have to guess.
    sqliteSchema: v.sqliteSchema ?? null,
    // Same reasoning as `sqliteSchema` above: a header row is a few short
    // strings, so persisting it keeps the source's own CSV layout knowable
    // after a reload instead of re-guessed from the app's internal schema.
    csvColumns: v.csvColumns ?? null,
    // And the same for the dialect: two short strings, and without them a
    // ;-delimited or LF source would silently return as comma + CRLF after a
    // reload, re-parsed from the raw text only to guess the wrong shape.
    csvDialect: v.csvDialect ?? null,
  }));
}

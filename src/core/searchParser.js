/**
 * @fileoverview Search query parser — pure functions, no DOM.
 *
 * Turns the raw search input into a list of parsed terms:
 *  - Bare terms separated by whitespace are AND-ed keywords:
 *      'term1 term2' -> [{ terms: ['term1'], exact: false },
 *                        { terms: ['term2'], exact: false }]
 *  - A phrase wrapped in double quotes is an exact phrase kept as one term:
 *      '"term1 term2"' -> [{ terms: ['term1 term2'], exact: true }]
 *  - Bare terms and quoted phrases can be mixed:
 *      'foo "bar baz" qux' -> [foo (keyword), 'bar baz' (exact), qux (keyword)]
 *  - An unbalanced trailing quote is treated literally (graceful degradation).
 */

/**
 * Parsed search term.
 * @typedef {object} ParsedTerm
 * @property {string} terms - Lowercased term text.
 * @property {boolean} exact - True when the term was quoted (exact phrase).
 */

/**
 * Parse the raw search input into AND-ed terms.
 *
 * @param {string} raw - Raw query string from the search input.
 * @returns {ParsedTerm[]} Parsed terms (empty when the query is blank).
 */
export function parseSearchQuery(raw) {
  const q = (raw || '').trim();
  if (q === '') return [];

  const terms = [];
  // Match either a quoted phrase or a run of non-space characters.
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    if (m[1] !== undefined) {
      // Quoted phrase — may be empty after trimming; skip empties.
      const phrase = m[1].trim();
      if (phrase !== '') terms.push({ terms: phrase.toLowerCase(), exact: true });
    } else {
      terms.push({ terms: m[2].toLowerCase(), exact: false });
    }
  }
  return terms;
}

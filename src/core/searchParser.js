/**
 * @fileoverview Search query parser — pure functions, no DOM.
 *
 * Turns the raw search input into a list of parsed terms:
 *  - Bare terms separated by whitespace are AND-ed keywords:
 *      'term1 term2' -> [{ terms: 'term1', exact: false, urlOnly: false },
 *                        { terms: 'term2', exact: false, urlOnly: false }]
 *  - A phrase wrapped in double quotes is an exact phrase kept as one term:
 *      '"term1 term2"' -> [{ terms: 'term1 term2', exact: true, urlOnly: false }]
 *  - Bare terms and quoted phrases can be mixed:
 *      'foo "bar baz" qux' -> [foo (keyword), 'bar baz' (exact), qux (keyword)]
 *  - 'link:<value>' is a URL field operator — the term matches ONLY within
 *    the bookmark URL (AND-ed with the rest of the query):
 *      'link:google.com keyword' -> [{ terms: 'google.com', urlOnly: true },
 *                                     { terms: 'keyword', urlOnly: false }]
 *    The operator is case-insensitive ('LINK:' works too) and the value may
 *    be quoted: link:"exact phrase".
 *  - An unbalanced trailing quote is treated literally (graceful degradation);
 *    a bare 'link:' with no value is kept as a literal keyword.
 */

/**
 * Parsed search term.
 * @typedef {object} ParsedTerm
 * @property {string} terms - Lowercased term text.
 * @property {boolean} exact - True when the term was quoted (exact phrase).
 * @property {boolean} urlOnly - True for 'link:' terms (URL field operator).
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
  // Order matters: link:<value> (quoted or bare, case-insensitive),
  // then a quoted phrase, then any other run of non-space characters.
  const re = /link:(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/gi;
  let m;
  while ((m = re.exec(q)) !== null) {
    if (m[1] !== undefined || m[2] !== undefined) {
      // link: operator — value may be quoted or bare.
      const value = (m[1] !== undefined ? m[1] : m[2]).trim();
      if (value !== '') {
        terms.push({ terms: value.toLowerCase(), exact: m[1] !== undefined, urlOnly: true });
      } else {
        // link:"" — empty value: keep the operator literally.
        terms.push({ terms: 'link:', exact: false, urlOnly: false });
      }
    } else if (m[3] !== undefined) {
      // Quoted phrase — may be empty after trimming; skip empties.
      const phrase = m[3].trim();
      if (phrase !== '') terms.push({ terms: phrase.toLowerCase(), exact: true, urlOnly: false });
    } else {
      terms.push({ terms: m[4].toLowerCase(), exact: false, urlOnly: false });
    }
  }
  return terms;
}

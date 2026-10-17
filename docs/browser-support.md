# Browser support

## The floor

| Engine                | Minimum        | Notes            |
| --------------------- | -------------- | ---------------- |
| Chrome                | 120 (Dec 2023) |                  |
| Edge                  | 120            | tracks Chrome    |
| Firefox               | 125 (Apr 2024) |                  |
| Safari (macOS/iPadOS) | 17 (Sep 2023)  |                  |
| Safari (iOS)          | 17             |                  |
| Samsung Internet      | 24.0           | Chrome 120-based |

The floor is the 2024 evergreen set — every entry ships the
`Intl.Segmenter` built-in the primary word-cloud path depends on, which
became **Baseline Newly available on 2024-04-16** ([web.dev](https://web.dev/blog/intl-segmenter);
[caniuse](https://caniuse.com/mdn-javascript_builtins_intl_segmenter)
puts global support at ~96.6% as of 2026-09). Firefox 125 (Apr 2024) is
the binding constraint, matching that Baseline date.

It is declared as `browserslist` in `package.json`. **No tool in this
repo currently reads it** — the build syntax level is pinned explicitly
as `build.target: 'es2022'` in `vite.config.js`, and there is no
autoprefixer or compat linter — so the key is the machine-readable
policy statement, ready for tooling that adopts it later.

## Three floors, not one

- **Runtime floor** (this file, `browserslist`): what users may run.
- **Dev/CI floor** (`engines`): Node >= 24, pnpm >= 12 — CI runs Node 24.
- **Build syntax floor** (`build.target: 'es2022'`): what the bundle
  may emit. Audited 2026-10 against the runtime floor: `src/` uses no
  top-level await, `Array.prototype.at`, class static blocks, or private
  methods, so current ES2022-era output stays within the floor (the
  floor browsers all predate full ES2022 support). Re-run that audit
  when `build.target` or the syntax usage changes.

## Below the floor: degraded, not broken

Every `Intl.Segmenter` use is feature-detected
(`typeof Intl.Segmenter === 'function'`); no polyfill ships.

| Missing capability              | Effect                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Intl.Segmenter`                | Word cloud falls back to the legacy tokenizer for **every** language (regex words + CJK bigrams). Similarity always uses it anyway. Everything else unaffected. |
| `compromise` chunk load failure | All languages degrade to the plain path together (stems/surfaces); the view never loops on the loading state.                                                   |

Browsers below the floor are **untested** — the contract is "degrades,
never crashes", not a support commitment.

## When may a fallback be deleted?

Only when **both** hold:

1. **The floor covers the capability** it replaces — true for every
   `Intl.Segmenter`-based path, since all floor browsers ship it.
2. **No importer remains** — the legacy tokenizer is still the sole
   splitter behind TF-IDF similarity (`similarity.js`), so it survives
   until that migration lands with re-baselined fixtures. `simpleStem`
   is load-bearing beyond the splitter (see its JSDoc) and is never
   deleted with it.

Raising or lowering the floor means updating `browserslist`, this file,
and the source audit **together** in one change.

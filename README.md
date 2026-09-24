# Read Later Lens — 稍後閱讀透鏡

A **fully client-side**, privacy-first bookmark aggregator, search tool, and text-analytics **lens** for read-later exports — **Instapaper today, more sources tomorrow**. Import your bookmarks, explore them through word clouds, domain statistics, and an interactive D3 concept graph, and discover related articles with TF-IDF / cosine similarity — all without a server and _without your data ever leaving the browser_.

Everything runs as a single-page app powered by Vite. After a one-time install, start the dev server and open it in a modern browser.

---

## Features

- **Source-picker import** — choose an explicit source type (InstapaperScraper or this app's unified export) in an intermediate modal, then load `CSV` / `JSON` / native SQLite (`.db`, `.sqlite`) files — multiple at once, with duplicate-file conflict resolution (overwrite / keep both / cancel). The official Instapaper account CSV (links-only) is detected and blocked with guidance.
- **Unified data model** — records from every format are normalized into a single schema that tolerates common (and case-varied) field-name variations; rows without a usable URL are skipped and reported.
- **Full-text search** — instant search across title, URL, preview text, and tags, with relevance-, date-, and title-based sorting.
- **Filtering** — drill down by imported source file/folder, auto-detected language (`EN` / `ZH` / `JA` / other), and custom tags.
- **Four analysis views**:
  - 📇 **Bookmark cards** — responsive grid with select-all and batch delete.
  - ☁️ **Word cloud** — stopword-filtered, stemmed keyword analysis with CJK character/n-gram tokenization.
  - 📊 **Domain analytics** — top-15 source-domain breakdown with click-to-filter.
  - 🕸️ **Concept linkage graph** — an interactive D3 force-directed graph built from shared keywords and domains.
- **In-app reader** — preview article text without leaving the app, open the original URL, or jump straight to Instapaper's reader.
- **Similarity recommendations** — pick any article to see related items ranked by TF-IDF vector cosine similarity.
- **Export** — save your changes back as unified versioned `JSON` / `CSV`, or re-export each source in its original format.
- **Local persistence** — your working set is cached in IndexedDB and restored automatically on your next visit.

---

## Getting Started

The app is a Vite-powered single-page app with bundled npm dependencies. There is a build/serve step; it is **not** a self-contained single file.

### Prerequisites

- [Node.js](https://nodejs.org/) >= 24.0.0
- [pnpm](https://pnpm.io/) >= 12.0.0

### Quick start

```bash
# 1. Install dependencies (one-time)
#    This also runs the `prepare` script, which sets up Git hooks via Husky.
pnpm install

# 2. Start the dev server
pnpm dev
```

Then open the URL the dev server prints (usually `http://localhost:5173`).

> Works best in modern Chrome/Edge/Firefox. The app is not designed for fully offline operation — its dependencies load from npm at dev/build time, and first load in the browser still needs an internet connection to load the CDN libraries listed below.

### Development scripts

| Command            | Description                                                   |
| ------------------ | ------------------------------------------------------------- |
| `pnpm dev`         | Start the Vite dev server (with hot module replacement)       |
| `pnpm build`       | Build the production bundle to `dist/`                        |
| `pnpm preview`     | Serve the production build locally for verification           |
| `pnpm lint`        | Run ESLint on `src/` and `tests/` (check only, zero warnings) |
| `pnpm lint:fix`    | Run ESLint with auto-fix on `src/` and `tests/`               |
| `pnpm format`      | Check formatting with Prettier (does not modify files)        |
| `pnpm format:fix`  | Auto-format the repository with Prettier                      |
| `pnpm test`        | Run the Vitest suite once                                     |
| `pnpm test:watch`  | Run Vitest in watch mode                                      |
| `pnpm lint-staged` | Run lint-staged manually (normally invoked by the Git hook)   |

### Building and previewing

```bash
# Produce the production bundle
pnpm build

# Preview the production build locally
pnpm preview
```

`pnpm build` emits the deployable single-page app under `dist/`. `pnpm preview` serves that output locally so you can verify the built artifact before shipping it.

### Git hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to enforce code quality automatically:

- **Pre-commit** — runs `lint-staged`, which applies ESLint (`--fix`) and Prettier to staged `*.{js,mjs,cjs}` files, and Prettier to staged `*.{json,css,md}` files.
- Hooks are installed automatically when you run `pnpm install` (via the `prepare` script).
- To bypass hooks for an urgent commit, use `git commit --no-verify` (use sparingly).

---

## Import & Data Model

Click **匯入 (Import)** in the top-right corner to open the **source picker** — an intermediate modal where you choose the data source _before_ any file dialog appears. Pick a source type (InstapaperScraper is preselected and the choice is remembered for the session), press **選擇檔案…**, then select one or more `*.csv`, `*.json`, or `*.db` / `*.sqlite` files. Each imported file becomes a _source file_ (shown as a folder in the sidebar) that groups its bookmarks and records the profile it was imported under.

### Source types

| Profile                          | Label in the UI          | Accepts                                                                                                                            | Behaviour                                                       |
| -------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `instapaper-scraper` _(default)_ | InstapaperScraper 匯出   | CSV / JSON / SQLite from [InstapaperScraper](https://github.com/chriskyfung/InstapaperScraper) (or equivalent Instapaper API data) | `provider` / `instapaper_url` regenerated as Instapaper values  |
| `rll-unified`                    | Read Later Lens 統一匯出 | Files previously exported by this app (unified JSON/CSV, source re-exports)                                                        | `provider` and `instapaper_url` round-trip from the source rows |
| _(roadmap)_                      | Raindrop / Pocket …      | —                                                                                                                                  | Rendered disabled — more sources are planned                    |

There is **no auto-detection** — the choice is explicit. A deterministic header sanity check then acts as a guard rail only:

- **The official Instapaper account CSV is not supported.** That export (`URL,Title,Selection,Folder,Timestamp,Tags`) carries only links — no ids, previews, or article text — so importing it would create rows of placeholder records. The import is blocked with guidance to use an InstapaperScraper export instead.
- If the columns clearly belong to the _other_ supported profile, the import still proceeds (your choice wins) with a warning appended to the success toast.
- Files the check cannot fingerprint pass through to the alias-tolerant parser unchanged. SQLite files are not header-checked: the official export is CSV-only, and both known table shapes (`articles`, `bookmarks`) already parse.

### Unified records

Records from any format are normalized into a unified `BookmarkRecord` with an alias-tolerant, **case-insensitive** parser:

| Unified field           | Recognized aliases                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | `id`, `bookmark_id`, `uid`; otherwise a **stable synthetic id** derived from the URL (`gen_` + FNV-1a-64 hash), so re-importing an id-less file merges instead of duplicating rows |
| `title`                 | `title`, `name` (falls back to `Untitled Article`)                                                                                                                                 |
| `url`                   | `url`, `link`, `original_url` — **rows without a usable URL are skipped** and reported in the import summary                                                                       |
| `article_preview`       | `article_preview`, `description`, `preview`, `excerpt`, `summary`                                                                                                                  |
| `content`               | `content`, else the resolved preview                                                                                                                                               |
| `instapaper_url`        | generated as `https://www.instapaper.com/read/<id>` (preserved as-is under the unified profile)                                                                                    |
| `source_file_id / name` | set from the imported file                                                                                                                                                         |
| `detected_language`     | auto-detected from title + preview                                                                                                                                                 |
| `tags`                  | array, or comma-separated string                                                                                                                                                   |

Other import rules:

- **Duplicate IDs are merged on import** (incoming record wins).
- The success toast reports exactly what happened: imported count, rows skipped for parse failures / missing URLs, trash resurrections, and any sanity-check warning.
- **An import is all-or-nothing**: the source record, the merged bookmarks and the browser-cache write are committed together, and a failed write (private mode, storage full) rolls the whole import back with `已還原匯入 <file>：無法寫入本機快取，資料不會保留`. The session therefore never displays bookmarks that a reload would not reproduce.
- **Unified JSON exports are versioned**: `all_bookmarks_export.json` wraps rows in `{ "format": "read-later-lens", "version": 1, "bookmarks": [...] }`. The envelope is recognized exactly on re-import; plain arrays and older exports keep working.

## Feature Tour

### Bookmark cards (書籤列表)

A responsive card grid with select-all, batch delete, and per-card actions including **similarity analysis** (⚡ 相似) and opening the reader. Destructive deletes — per-card and batch — are confirmed with a dialog before mutating state. Cards honor the current search, folder, language, and tag filters.

### Word cloud (☁️ 文字雲)

Keyword terms are extracted from titles and previews using an **extended English stopword list**, a lightweight **stemmer**, and **character/n-gram tokenization for CJK text**. Each term’s size reflects its frequency. **Click any keyword to run a global search for it.**

### Domain analytics (📊 域名統計)

Aggregates your collection into the **top 15 source domains**. Click a domain to instantly filter the list to that source.

### Concept linkage graph (🕸️ 概念關聯網)

An interactive **D3 force-directed graph** (limited to the top 50 filtered bookmarks for clarity) that builds topology from **shared keywords and domains**:

- **Node size** = connectivity/degree
- **Color** = source domain
- **Scroll to zoom, drag to pan**, and use the on-screen zoom / reset controls
- Hover to inspect the title, domain, and tags in a tooltip

### Reader & similarity

- **Reader modal** opens on card click: shows the preview, the original URL, and a button to open the bookmark in the Instapaper reader. Its footer also exposes inline actions — 🗑️ 刪除 (confirm-gated, reuses the grid delete prompt) and ⚡ 相似 (opens the similarity drawer for the same bookmark).
- **Dialog accessibility & keyboard** — every dialog is `role="dialog"` / `aria-modal`, moves focus inside when opened and restores it to the trigger when closed; press **Esc** to close the topmost open dialog and **Tab** stays contained within it.
- **Similarity modal** tokenizes the target article and your library into TF-IDF vectors, then ranks the most similar articles by **cosine similarity** (shown as a percentage).

## Storage & Privacy

- **Everything runs locally in your browser.** No account, no server, no analytics; your bookmarks and source files are never transmitted anywhere.
- Your working set is cached in your browser’s **IndexedDB** (database `ReadLaterLensDB`) and automatically restored when you revisit the page.
- **SQLite parsing is local and lazy:** CSV/JSON imports do not initialize SQL.js; `.db`/`.sqlite` imports load the locally bundled SQL.js/WASM engine only when needed. The raw SQLite buffer is retained in **memory only** and is _not_ persisted to IndexedDB. To reliably re-export a `.db` source after closing the page, re-import it — or use the unified `JSON` / `CSV` export, which is always persisted and available.
- Use the **清除快取 (Clear cache)** button in the header to wipe the stored bookmark cache.

## Technology Stack

PapaParse and D3.js remain runtime CDN dependencies. SQL.js is bundled locally and loaded lazily only for SQLite imports; build tooling, styling, and the IndexedDB wrapper are provided through npm dependencies declared in `package.json`.

| Library                                                          | Version | Loading            | Purpose                                           |
| ---------------------------------------------------------------- | ------- | ------------------ | ------------------------------------------------- |
| [Tailwind CSS](https://tailwindcss.com/)                         | 4.3.3   | npm (bundled)      | Utility-first styling and the dark slate UI       |
| [PapaParse](https://github.com/mholt/PapaParse)                  | 5.4.1   | CDN (runtime)      | CSV parsing                                       |
| [SQL.js](https://sql.js.org/)                                    | 1.14.2  | npm (lazy bundled) | WebAssembly SQLite — `.db` import/parse/re-export |
| [D3.js](https://d3js.org/)                                       | 7.8.5   | CDN (runtime)      | Force-directed concept linkage graph              |
| [idb](https://github.com/jakearchibald/idb)                      | 8.x     | npm (bundled)      | IndexedDB promise wrapper                         |
| [Vite](https://vite.dev/)                                        | 8.x     | npm (dev)          | Dev server and production bundler                 |
| [Vitest](https://vitest.dev/)                                    | 4.x     | npm (dev)          | Unit testing framework                            |
| [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) | latest  | npm (dev)          | Linting and formatting                            |

See `package.json` for the full dependency list.

## Project Structure

The whole app — interface, data processing, NLP/analytics, and visualizations — is split across the modules above, with `src/main.js` as the Vite entry that composes them and `index.html` as the single HTML shell.

## Known Limitations

- The **concept graph is capped at the top 50** filtered bookmarks to keep the topology readable.
- **The official Instapaper account CSV is not supported** (links-only schema, no previews or ids) — the picker's sanity check blocks it and suggests an InstapaperScraper export instead. Header fingerprinting covers CSV/JSON only; SQLite files are not header-checked.
- **SQLite source re-export** depends on an in-memory SQL.js database; raw `.db` buffers are not cached to IndexedDB (see [Storage & Privacy](#storage--privacy)).
- CDN-loaded libraries require an internet connection on first load; the app is not designed for fully offline operation.
- The project is a **single-page app with bundled dependencies** — there is a dev/build step (Vite + pnpm), not a self-contained single file.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide (development setup, scripts, code style, testing, and Git hooks).

Quick summary of the conventions already established in this repository:

- **Conventional Commits** — commit messages follow the `⟨type⟩(⟨scope⟩): ⟨summary⟩` convention (e.g. `fix(ui): …`, `refactor(viz): …`, `feat(search): …`).
- **Feature-branch workflow** — work on a topic branch and keep the working tree clean.
- **Line endings** — `.gitattributes` enforces LF; keep it that way.
- **Code style** — JavaScript follows the Prettier config (`.prettierrc`) and passes ESLint with zero warnings (`pnpm lint:fix`, `pnpm format:fix`).
- **Git hooks** — a pre-commit hook runs lint-staged automatically on every commit (installed via `pnpm install`).
- **UI language** — end-user-facing copy is currently **Traditional Chinese (zh-TW)**; preserve that unless intentionally changing the localization approach.
- **Architecture discipline** — keep `src/main.js` as the thin bootstrap composing extracted modules, and preserve the component-markup vs. view-behavior separation (markup helpers in `src/components/`, listener wiring in `src/views/`).

## License

[GNU AGPL-3.0](LICENSE) © chriskyfung

# Read Later Lens — 稍後閱讀透鏡

A **fully client-side**, privacy-first bookmark aggregator, search tool, and text-analytics **lens** for read-later exports — **Instapaper today, more sources tomorrow**. Import your bookmarks, explore them through word clouds, domain statistics, and an interactive D3 concept graph, and discover related articles with TF-IDF / cosine similarity — all without a server and _without your data ever leaving the browser_.

Everything runs as a single-page app powered by Vite. After a one-time install, start the dev server and open it in a modern browser.

---

## Features

- **Multi-format import** — load Instapaper exports as `CSV`, `JSON`, or native SQLite (`.db`), including multiple files at once, with duplicate-file conflict resolution (overwrite / keep both / cancel).
- **Unified data model** — records from every format are normalized into a single schema that tolerates common field-name variations.
- **Full-text search** — instant search across title, URL, preview text, and tags, with relevance-, date-, and title-based sorting.
- **Filtering** — drill down by imported source file/folder, auto-detected language (`EN` / `ZH` / `JA` / other), and custom tags.
- **Four analysis views**:
  - 📇 **Bookmark cards** — responsive grid with select-all and batch delete.
  - ☁️ **Word cloud** — stopword-filtered, stemmed keyword analysis with CJK character/n-gram tokenization.
  - 📊 **Domain analytics** — top-15 source-domain breakdown with click-to-filter.
  - 🕸️ **Concept linkage graph** — an interactive D3 force-directed graph built from shared keywords and domains.
- **In-app reader** — preview article text without leaving the app, open the original URL, or jump straight to Instapaper's reader.
- **Similarity recommendations** — pick any article to see related items ranked by TF-IDF vector cosine similarity.
- **Export** — save your changes back as unified `JSON` / `CSV`, or re-export each source in its original format.
- **Local persistence** — your working set is cached in IndexedDB and restored automatically on your next visit.

---

## Getting Started

The app is a Vite-powered single-page app with bundled npm dependencies. There is a build/serve step; it is **not** a self-contained single file.

### Prerequisites

- [Node.js](https://nodejs.org/) (current LTS or newer)
- [pnpm](https://pnpm.io/)

### Quick start

```bash
# 1. Install dependencies (one-time)
pnpm install

# 2. Start the dev server
pnpm dev
```

Then open the URL the dev server prints (usually `http://localhost:5173`).

> Works best in modern Chrome/Edge/Firefox. The app is not designed for fully offline operation — its dependencies load from npm at dev/build time, and first load in the browser still needs an internet connection to load the CDN libraries listed below.

### Building and previewing

```bash
# Produce the production bundle
pnpm build

# Preview the production build locally
pnpm preview
```

`pnpm build` emits the deployable single-page app under `dist/`. `pnpm preview` serves that output locally so you can verify the built artifact before shipping it.

---

## Import & Data Model

Click **匯入 (Import)** in the top-right corner to select one or more `*.csv`, `*.json`, or `*.db` files. Each imported file becomes a _source file_ (shown as a folder in the sidebar) that groups its bookmarks.

Records from any format are normalized into a unified `BookmarkRecord` with an alias-tolerant parser:

| Unified field           | Recognized aliases                                                |
| ----------------------- | ----------------------------------------------------------------- |
| `id`                    | `id`, `bookmark_id`, `uid` (auto-generated if missing)            |
| `title`                 | `title`, `name` (falls back to `Untitled Article`)                |
| `url`                   | `url`, `link`, `original_url`                                     |
| `article_preview`       | `article_preview`, `description`, `preview`, `excerpt`, `summary` |
| `content`               | `content`, else the resolved preview                              |
| `instapaper_url`        | generated as `https://www.instapaper.com/read/<id>`               |
| `source_file_id / name` | set from the imported file                                        |
| `detected_language`     | auto-detected from title + preview                                |
| `tags`                  | array, or comma-separated string                                  |

Duplicate IDs are merged on import.

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
- **Cache caveat for SQLite files:** while `.db` files are parsed with in-memory SQL.js SQLite (safe for browsing/searching), the raw SQLite buffer is retained in **memory only** and is _not_ persisted to IndexedDB. To reliably re-export a `.db` source after closing the page, re-import it — or use the unified `JSON` / `CSV` export, which is always persisted and available.
- Use the **清除快取 (Clear cache)** button in the header to wipe the stored bookmark cache.

## Technology Stack

All libraries are loaded from public CDNs at runtime — there are no bundled or vendored dependencies.

| Library                                         | Version      | Purpose                                           |
| ----------------------------------------------- | ------------ | ------------------------------------------------- |
| [Tailwind CSS](https://tailwindcss.com/)        | CDN (latest) | Utility-first styling and the dark slate UI       |
| [PapaParse](https://github.com/mholt/PapaParse) | 5.4.1        | CSV parsing                                       |
| [SQL.js](https://sql.js.org/)                   | 1.8.0        | WebAssembly SQLite — `.db` import/parse/re-export |
| [D3.js](https://d3js.org/)                      | 7.8.5        | Force-directed concept linkage graph              |

## Project Structure

The whole app — interface, data processing, NLP/analytics, and visualizations — is split across the modules above, with `src/main.js` as the Vite entry that composes them and `index.html` as the single HTML shell.

## Known Limitations

- The **concept graph is capped at the top 50** filtered bookmarks to keep the topology readable.
- **SQLite source re-export** depends on an in-memory SQL.js database; raw `.db` buffers are not cached to IndexedDB (see [Storage & Privacy](#storage--privacy)).
- CDN-loaded libraries require an internet connection on first load; the app is not designed for fully offline operation.
- The project is a **single-page app with bundled dependencies** — there is a dev/build step (Vite + pnpm), not a self-contained single file.

## Contributing

Contributions are welcome. Please follow the conventions already established in this repository:

- **Conventional Commits** — commit messages follow the `⟨type⟩(⟨scope⟩): ⟨summary⟩` convention (e.g. `fix(ui): …`, `refactor(viz): …`, `feat(search): …`).
- **Feature-branch workflow** — work on a topic branch and keep the working tree clean.
- **Line endings** — `.gitattributes` enforces LF; keep it that way.
- **UI language** — end-user-facing copy is currently **Traditional Chinese (zh-TW)**; preserve that unless intentionally changing the localization approach.
- **Architecture discipline** — keep `src/main.js` as the thin bootstrap composing extracted modules, and preserve the component-markup vs. view-behavior separation (markup helpers in `src/components/`, listener wiring in `src/views/`).

## License

[GNU AGPL-3.0](LICENSE) © chriskyfung

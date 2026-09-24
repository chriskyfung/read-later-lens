# Contributing to Read Later Lens

Thank you for your interest in contributing! This guide covers everything you need to set up a local development environment, follow the project's conventions, and submit changes.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Development Scripts](#development-scripts)
- [Code Style](#code-style)
- [Testing](#testing)
- [Git Hooks](#git-hooks)
- [Commit Messages](#commit-messages)
- [Pull Request Workflow](#pull-request-workflow)
- [Project Structure](#project-structure)
- [Architecture Guidelines](#architecture-guidelines)

## Prerequisites

| Tool                           | Version            | Notes                                                         |
| ------------------------------ | ------------------ | ------------------------------------------------------------- |
| [Node.js](https://nodejs.org/) | >= 24.0.0          | Enforced via `engines` in `package.json`                      |
| [pnpm](https://pnpm.io/)       | >= 12.0.0          | Enforced via `engines` and `packageManager` in `package.json` |
| Git                            | any recent version | For branching, hooks, and PRs                                 |

> **Tip:** Enable [Corepack](https://nodejs.org/api/corepack.html) (`corepack enable pnpm`) so the exact `pnpm` version pinned in `packageManager` is used automatically.

## Setup

```bash
# 1. Fork and clone your fork
git clone https://github.com/<your-username>/read-later-lens.git
cd read-later-lens

# 2. Add the upstream repository
git remote add upstream https://github.com/chriskyfung/read-later-lens.git

# 3. Install dependencies
#    This runs the `prepare` script, which installs the Husky Git hooks.
pnpm install

# 4. Start the dev server
pnpm dev
```

Then open the URL the dev server prints (usually `http://localhost:5173`).

## Development Scripts

| Command            | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| `pnpm dev`         | Start the Vite dev server with hot module replacement                     |
| `pnpm build`       | Build the production bundle to `dist/`                                    |
| `pnpm preview`     | Serve the production build locally for verification                       |
| `pnpm lint`        | Run ESLint on `src/` and `tests/` (check only, **zero warnings allowed**) |
| `pnpm lint:fix`    | Run ESLint with auto-fix                                                  |
| `pnpm format`      | Check formatting with Prettier (read-only)                                |
| `pnpm format:fix`  | Auto-format the whole repository with Prettier                            |
| `pnpm test`        | Run the Vitest suite once (`--passWithNoTests`)                           |
| `pnpm test:watch`  | Run Vitest in watch mode                                                  |
| `pnpm lint-staged` | Run lint-staged manually (normally invoked by the pre-commit hook)        |
| `pnpm prepare`     | Install/update the Husky Git hooks                                        |

## Code Style

- **Prettier** formats all JavaScript, JSON, CSS, and Markdown. The configuration lives in [`.prettierrc`](.prettierrc):
  - `semi: true`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 2`, `endOfLine: lf`
- **ESLint** lints `src/` and `tests/` with the flat config in [`eslint.config.mjs`](eslint.config.mjs).
  - `eslint-config-prettier` is applied last to disable all formatting rules that would conflict with Prettier.
- **Line endings** — `.gitattributes` enforces LF (`* text=lf`). Do not commit CRLF files.
- **Editor setup** — `.vscode/settings.json` enables `formatOnSave` with Prettier as the default formatter and `prettier.requireConfig: true`. If you use another editor, configure it to respect `.prettierrc`.

Before committing, you can run a full check:

```bash
pnpm lint:fix && pnpm format:fix && pnpm test
```

## Testing

- The test suite uses [Vitest](https://vitest.dev/) with [jsdom](https://github.com/jsdom/jsdom) and [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB).
- Tests live in the [`tests/`](tests/) directory and follow the naming convention `<area>.test.js` or `<area>-<detail>.test.js`.
- Run tests once with `pnpm test` or in watch mode with `pnpm test:watch`.
- `pnpm test` uses `--passWithNoTests`, so it succeeds even when no test files match (useful in CI for branches without test changes).
- Please add or update tests for any behavior change.

## Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks and [lint-staged](https://github.com/lint-staged/lint-staged) to run checks only on staged files.

### Pre-commit

When you run `git commit`, the `pre-commit` hook runs `pnpm lint-staged`, which:

- On `*.{js,mjs,cjs}` files: runs `eslint --fix --max-warnings 0`, then `prettier --write`
- On `*.{json,css,md}` files: runs `prettier --write`

Hooks are installed automatically when you run `pnpm install` (via the `prepare` script). The `.husky/_/` helper directory is auto-generated and git-ignored; only the hook scripts themselves (e.g., `.husky/pre-commit`) are tracked.

### Bypassing hooks

If you need to skip the pre-commit hook for an urgent commit:

```bash
git commit --no-verify -m "your message"
```

Use this sparingly — CI will still run linting and tests.

## Commit Messages

This repository follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary>
```

- **type** — one of `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `ci`, `build`, `revert`
- **scope** (optional) — the affected area, e.g. `ui`, `viz`, `search`, `io`, `db`, `deps`, `config`
- **summary** — imperative mood, lower case, no trailing period

Examples:

```
feat(io): add multi-file CSV import with conflict resolution
fix(ui): restore focus to trigger after modal close
chore(deps): upgrade vite to 8.3.0
docs(readme): document IndexedDB cache caveat
```

## Pull Request Workflow

1. Create a topic branch from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feat/my-feature
   ```
2. Make your changes and add/update tests.
3. Ensure all checks pass locally:
   ```bash
   pnpm lint:fix && pnpm format:fix && pnpm test && pnpm build
   ```
4. Commit using Conventional Commits (the pre-commit hook will run automatically).
5. Push your branch and open a PR against `main`.
6. Keep the working tree clean and respond to review feedback.

Dependabot opens weekly PRs for dependency updates (grouped by type) — review and merge them promptly to avoid drift.

## Project Structure

```
├── index.html              # Single HTML shell (loads remaining CDN runtime libraries)
├── src/
│   ├── main.js             # Thin bootstrap that composes extracted modules
│   ├── components/         # Markup helpers (pure DOM element builders)
│   ├── views/              # View behavior (listener wiring, render logic)
│   ├── core/               # State, filters, search parser, store
│   ├── analytics/          # NLP, tokenization, language detection, similarity
│   ├── io/                 # Import/export (CSV, JSON, SQLite)
│   └── i18n/               # Locale files (zh-TW)
├── tests/                  # Vitest test suite
├── .husky/                 # Git hooks (Husky)
├── eslint.config.mjs       # ESLint flat config
├── .prettierrc             # Prettier config
└── .prettierignore         # Prettier ignore rules
```

## Architecture Guidelines

- Keep `src/main.js` as the **thin bootstrap** that composes extracted modules — do not grow it into a monolith.
- Preserve the **component-markup vs. view-behavior separation**:
  - Markup helpers live in `src/components/` (pure functions that return DOM elements).
  - Listener wiring and view behavior live in `src/views/`.
- **End-user-facing copy** is currently **Traditional Chinese (zh-TW)**; preserve that unless intentionally changing the localization approach.
- The app is **fully client-side** — do not introduce server-side calls or transmit user data anywhere.

## License

By contributing, you agree that your contributions will be licensed under the [GNU AGPL-3.0](LICENSE).

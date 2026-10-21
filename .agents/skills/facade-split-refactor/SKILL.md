---
name: facade-split-refactor
description: Implement a "extract folder-behind-facade" refactor
---

## Purpose

Help a future agent plan and implement a "extract folder-behind-facade" refactor like `src/components/header.js` → `src/components/header/*` + `src/views/header/*`, preserving behavior while adding internal structure.

## Trigger phrases

- "modularize X"
- "split X into folder"
- "extract module X"
- "mirror the trash split"
- "refactor into components/<area>/*"
- "create a facade for X"

## Skill body

### 1. Map before touching

- List every importer of the target file (exact import-path grep, not fuzzy).
- List every exported name and who consumes each one.
- List every test file that imports the target or its behavior.
- Record the baseline: run the focused tests **before** any edit (e.g. `pnpm test:quiet <focused files>`).

### 2. Choose the split shape

- **Presentational → `src/components/<area>/`**: pure string builders, zero state, barrel `index.js`.
- **Behavioral → `src/views/<area>/`**: `constants`, `deps` (DI seam), leaf `view` (DOM-only), orchestrators (`search`/`actions`/`controller`), `listeners` (wiring + disposer), facade re-export at the old path.
- Omit empty modules deliberately (no `controller` without lifecycle, no `service` without projection) and document the omission in the facade.

### 3. Invariants to enforce

- Old import paths keep working — facades re-export identical names.
- No import cycles: leaves import only constants; orchestrators import leaves; listeners import orchestrators.
- Single ownership for shared mutable state (e.g. one debounce-timer owner).
- Copy user-facing strings verbatim into `constants.js`; keep destructive-action order (gate → mutate → persist → toast).

### 4. Verify per slice

- Focused tests green; `eslint` + `prettier --check` + `git diff --check` on touched files only.
- One coherent commit per slice (markup vs behavior), emoji + Conventional Commits header, ≤8-line body, no unrelated files.

### 5. Report

Changed files, rationale, risks, checks run vs deferred to CI, follow-ups — never pasted into the commit body.

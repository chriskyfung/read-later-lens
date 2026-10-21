---
name: refactor-review-gate
description: Revise already-landed refactor commits and produce a professional PR message without mutating the tree
---

# Skill: refactor-review-gate

## Trigger phrases

- "revise commits"
- "check regressions"
- "no behavior differences"
- "suggest PR message"
- "review this refactor"

## Skill body

### 1. Read-only evidence gathering

- `git log --oneline` + `git diff <base>..HEAD --stat` for commit inventory.
- `git show <base>:<file>` into `/tmp` for old-vs-new comparison (never checkout old code into the tree).
- Full re-read of every new module at HEAD.
- Grep exact import paths to prove no external caller reaches into internals.

### 2. Parity audit checklist

- Markup: classes, ids, tooltips, placeholders, svg paths, i18n strings, mount order/position.
- Behavior: execution order, timing constants, guards, persist/render/toast sequencing, focus management, IME/edge-case handling.
- Classify every delta as (a) byte-identical, (b) cosmetic-only (comments/whitespace), or (c) strictly-safer hardening unreachable in tested paths. Flag anything else as a regression.

### 3. Hygiene checks (read-only commands only)

- `git status`, `git diff --check`, `eslint <touched>`, `prettier --check <touched>`.

### 4. PR message template

intent → changed contracts → security implications → validation performed (exact test counts) → known limitations.
State explicitly what is deferred to CI.

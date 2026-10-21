# Skill: commit-hygiene

## Purpose

Prevent recurring failure modes: committing unrelated pre-staged files, multiline shell-quoting breakage, and hook-surprise reformatting during refactors.

## Trigger phrases

- "commit"
- "create branch and implement"
- "stage"
- "push"

## Skill body

### Staging and slicing

- Never `git add -A`; stage exact pathspecs per slice, and commit with `git commit -- <paths>` so pre-existing staged files (e.g. `A AGENTS.md`) are never swept in.
- Never inline multiline commit messages in shell strings; write them to a temp `.tmp-commit-N.msg` file and use `git commit -F`, deleting the temp file afterwards.

### Verification expectation

- Expect the pre-commit hook (`lint-staged`: eslint --fix + prettier --write) and verify the tree after it runs — a commit is not done until post-hook state is green.

### Mode discipline

- Verify in plan mode with inspection commands only; never run state-changing commands there.

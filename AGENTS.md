# AGENTS.md

Operational guidance for AI agents working in this repository. [CONTRIBUTING.md](CONTRIBUTING.md)
is canonical for code style, tooling, the commit-message syntax, and the PR workflow — follow
both; this file adds the working practices that guide does not cover.

## Working agreement

- Work on one acceptance criterion at a time.
- Do not modify unrelated files.
- Propose a change plan before editing: the acceptance criterion, affected files, tests, and
  intended commit slices.
- Add or update focused tests for behavior changes.
- Before finishing, report changed files, rationale, risks, and tests run. See _Reporting_ for
  where that report belongs — and where it does not.

## Commit slices

- Keep each commit focused on one coherent and reversible concern.
- Do not mix feature behavior, unrelated refactors, dependency updates, generated output, CI
  changes, and formatting churn.
- Keep formatting out of the diff. Do not commit LF normalization, trailing-newline repairs, or
  repository-wide Prettier output alongside a behavioral change; give that work its own
  `chore`/`style` branch. `.gitattributes` and `.editorconfig` already declare the intended line
  endings, so a file's line endings are not a review concern: when reviewing, do not ask for LF
  normalization or end-of-file newline fixes on a change that did not touch those lines.
- Separate schema, API, UI, test, CI, and documentation changes when they are independently
  deployable; keep them together only when splitting creates an invalid or unsafe intermediate
  state.
- Every commit must leave the tree lint-clean and test-green. Formatting for the files a commit
  touches is applied by `lint-staged` at commit time, not by a repository-wide pass, and the suite
  runs once per change set at push rather than once per commit — see _What runs when_.
- Treat schema migrations, access control, security logic, environment configuration, and
  deployment changes as high-risk, and require explicit review.

## Commit message format

Every subject starts with an emoji, then a Conventional Commits header. The emoji is a _type_
marker, not decoration. Choose the type first, then the emoji that matches it:

| Type       | Emoji             | Type    | Emoji          |
| ---------- | ----------------- | ------- | -------------- |
| `feat`     | ✨ 🚸 🦺 🗃️ ♿️ 👔 | `test`  | ✅             |
| `fix`      | 🐛 🩹 🥅 🔒 🧱 💄 | `docs`  | 📝             |
| `refactor` | ♻️ 🔥 🚚          | `perf`  | ⚡️             |
| `style`    | 🎨 💬             | `chore` | 🔧 ➕ 🎉 🔖 ⬆️ |

💄 and 🔒 appear with two types each; pick whichever type the change actually is.

Use the rest of the header as [CONTRIBUTING.md](CONTRIBUTING.md) describes, and reference the
issue or PR number when the change resolves one.

Write a body only when it says something the diff cannot. The budget is **at most eight wrapped
lines at 72 columns** — a few sentences of `why`, then one line of verification. A body over
budget is a defect of the change: the surplus belongs in the PR description, not the commit.

Include a line only when it is non-obvious:

- **Why** the change is right, and what the previous behaviour got wrong.
- **External evidence**, when there is any — a spec line, a bug number, a link. If the change is
  hardening rather than a repair of a defect you can reproduce, say exactly that, so a reviewer
  is not misled about the severity.
- **A real cost**, only when the change has one — memory, latency, retention. A class-name
  migration has none: write "No behaviour change" or skip the line.

Name each thing once. A series that shares one reason states it in the first commit or the PR
description and gives every later commit one line; never repeat the same verification paragraph,
probe list, or negative control across a series.

The shape to aim for — the body of `171a9ad`, trimmed from 29 lines to 7:

```
The last bare rounded in src becomes rounded-sm at .25rem, so the
rendered value is unchanged. The badge is in
src/views/similarityModal.js, not the same-named component — a name-only
search attributes the line to the wrong file, and the component was
already migrated.

Fail-first: N/A — views.test.js pins only bg-emerald-950; suite 607/607
unchanged. Dead .rounded emission reported in the PR, not fixed here.
```

Commits must be GPG-signed, which this repository enforces. Confirm before finishing:

```
git --no-pager log -1 --format='%G? %s'   # G = good signature
```

## Verification discipline

- **Prove the test fails first.** Revert the source change, run the new test, and confirm it fails
  for the expected reason, then restore the change. A test that passes without the fix is not
  evidence that the fix works. Record it in one line — `Fail-first: <test> fails without the
change (<observed failure>)`, or `Fail-first: N/A — no test covers this path` — and keep the
  narrative in the report. Gather that observation with the focused file (`-t '<test name>'` if
  needed), not by running the suite twice.
- **Verify the premise before fixing it.** When a change comes from a reported defect, confirm the
  defect is real and still reproducible on current versions. If you cannot reproduce it, say so
  and frame the work as hardening.
- **Pin behaviour, not incidental values.** Assert ordering, counts, and observable effects rather
  than a constant's current value, so tuning the constant does not break the test.

### What runs when

Verification is tiered so each expensive check runs once per change set, not once per edit. Do not
run a tier whose work the next tier is about to do anyway.

| When         | Runs                                                              | How                        |
| ------------ | ----------------------------------------------------------------- | -------------------------- |
| Every edit   | the test file(s) that cover the change; lint of the files touched | `pnpm test:quiet <file>`   |
| `git commit` | ESLint `--fix` and Prettier on staged files                       | the `pre-commit` hook      |
| `git push`   | the full suite                                                    | the `pre-push` hook        |
| Pull request | lint, the full suite, and the build on Node 24                    | `.github/workflows/ci.yml` |

Iterate with the focused pair alone — the whole-repo suite is the expensive step, and it is about
to run at push anyway:

```
pnpm test:quiet tests/io-importer.test.js
pnpm exec eslint src/io/importer.js tests/io-importer.test.js
```

`pnpm test:quiet` is `pnpm test` with `--silent=passed-only`: it drops the passing tests' console
output and keeps the summary and every failure. Narrow it further with `-t '<test name>'`, and drop
the quiet flag when a passing test's log is what you need to explain a failure.

Run the full local gate **once per change set**, and only when the change can move the build or the
check configuration itself:

```
pnpm lint && pnpm test:quiet && pnpm build
```

- `vite.config.js`, `index.html`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`
- `package.json` or `pnpm-lock.yaml` (dependency or script changes)
- a new entry point, barrel module, or dynamic import that no test loads
- the CSS/Tailwind entry or asset handling
- `.github/workflows/**`

Otherwise do not build. A Markdown-only change cannot affect the linter (`eslint src/ tests/`
never reads it), the suite (`vitest` imports only `src/`), or the bundle — say that instead of
running the gate. For source changes the suite usually settles it, because Vitest resolves the
same imports the bundler does: a missing module or a syntax error fails a test first. What the
suite cannot see is the CSS pipeline, the asset graph, and the build config — which is what the
list above is for, and why CI builds every PR on a clean machine. The build is the cheap step; the
suite is the expensive one, and delegating the suite is the point of this policy.

Also run `git diff --check` for whitespace errors. Note that CI runs the linter, the suite, and the
build but no formatting check, so a stale format only surfaces from the pre-commit hook.

### Do not duplicate the hooks

Do not re-run by hand what a hook is about to run. `git push` runs the full suite through
`pre-push`, so a manual `pnpm test:quiet` immediately before pushing is the same CPU twice. Never
use `--no-verify` to skip a hook: fix the cause, and report a broken hook instead of routing around
it.

Never format the repository as a side effect of a change: `pnpm format:fix` and a bare
`prettier --write` rewrite every file they disagree with. Format only the files you changed, by
staging them and running exactly what the pre-commit hook runs:

```
git add <changed files> && pnpm lint-staged
```

If a file you never touched shows up as reformatted, drop it from the change instead of
committing the rewrite.

### Keep the transcript cheap

- Run one heavy command at a time. A full suite run alongside another `vitest` or ESLint process
  produced two failures in `tests/main-startup.test.js` — a 5000ms test timeout and a failed
  rollback assertion — that did not reproduce when the suite ran alone. Re-run the file alone
  before reporting it as a regression.
- Read the changed region, not the whole file, and never re-read a file that has not changed since
  you read it. `git --no-pager diff` is the cheaper source.
- Do not re-run a check whose result cannot have changed since the last green run; cite that run
  instead of repeating it.
- Capture the summary line and the failing cases, not the full log. Counts are the evidence.

## Reporting

Report changed files, rationale, risks, tests run, and follow-up work before finishing, and
propose commit slices rather than committing a mixed change set.

State which tier of verification ran and what is deferred to CI, so a report never implies more
verification than happened — the reduced local gate is only as safe as this claim:

    Checks: focused (tests/io-importer.test.js, 56/56); no build-affecting files, so the full
    suite and the build are deferred to CI.

PRs must state: intent, changed contracts, security implications, validation performed, and known
limitations. Report any defect you found and did not fix as follow-up work.

The report is not the commit body. Changed files, rationale, risks, follow-ups, and the full
verification narrative belong in the report and the PR description; a commit body carries only
the summary described under _Commit message format_. Never paste the report into a commit
message, and treat an over-budget body as a review defect rather than a sign of diligence.

## Stop conditions

- Leave the working tree clean, and remove any scratch or temporary files you created.
- Never touch a stash, branch, or uncommitted change you did not create.
- Do not commit files that happen to be staged or untracked but are unrelated to the change.
- Never commit secrets, unreviewed generated code, or broad permission changes.
- Do not send secrets, private configuration, customer data, or production logs to an external
  model provider.

AI-generated changes must be reviewed as untrusted input.

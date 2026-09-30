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
- Every commit must pass its lint and test checks. Formatting for the files a commit touches is
  applied by `lint-staged` at commit time, not by a repository-wide pass.
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
  narrative in the report.
- **Verify the premise before fixing it.** When a change comes from a reported defect, confirm the
  defect is real and still reproducible on current versions. If you cannot reproduce it, say so
  and frame the work as hardening.
- **Pin behaviour, not incidental values.** Assert ordering, counts, and observable effects rather
  than a constant's current value, so tuning the constant does not break the test.

Run the local gate before committing:

```
pnpm lint && pnpm test && pnpm build
```

Also run `git diff --check` for whitespace errors. Note that CI runs the linter, the suite, and the
build but no formatting check, so a stale format only surfaces from the pre-commit hook.

Never format the repository as a side effect of a change: `pnpm format:fix` and a bare
`prettier --write` rewrite every file they disagree with. Format only the files you changed, by
staging them and running exactly what the pre-commit hook runs:

```
git add <changed files> && pnpm lint-staged
```

If a file you never touched shows up as reformatted, drop it from the change instead of
committing the rewrite.

## Reporting

Report changed files, rationale, risks, tests run, and follow-up work before finishing, and
propose commit slices rather than committing a mixed change set.

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

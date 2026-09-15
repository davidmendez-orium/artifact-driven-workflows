---
category: documentation
name: to-coverage-report
description: After the slices are built (autonomous /goal or manual /tdd), audit whether the tests honestly cover the ticket's PRD requirements/AC and each tracer-bullet slice's AC — run the real test tooling for a quantitative baseline, fan out coverage-analyst agents per slice + one holistic pass, persist a gaps→recommendations report (the primary deliverable), then let the user pick which gaps to close and implement only the selected unit/integration tests. Use as the verification step at the end of the chain — grill-with-docs → to-prd → to-issues → to-goal-prompt → /goal (or /tdd) → e2e-pass → to-coverage-report.
argument-hint: '<ticket key, or path to the plan dir / execution-plan.md>'
disable-model-invocation: true
---

# To Coverage Report

After the build, this skill measures whether the tests actually cover what the ticket promised — the
PRD requirements + acceptance criteria, and the AC of every tracer-bullet slice — then fills the real
gaps. Two principles govern it:

- **Reporting-first.** The primary deliverable is ONE artifact, `<TICKET>-test-coverage-report.md`,
  written next to the other plan docs and persisted *before* anything is fixed. Closing the gaps is a
  separate, **user-gated** step.
- **Audits e2e, never runs it.** `/e2e-pass` authored and ran the e2e batch just before this skill.
  Here you **audit** those specs for usefulness like any other test; you never author, boot a stack,
  or run Playwright. Any e2e gap is deferred to a targeted `/e2e-pass` re-run.

**Test-usefulness, not just touch:** a test must quote the load-bearing assertion and name a product
mutation it would catch — a test with no nameable mutation is hollow → a gap.

Any commands shown below are **illustrative, not this project's**. Discover the real unit and e2e
runners and their invocations first — the package/build manifest's scripts, each runner's own config
file — and substitute. Never run a command from an example that this repo does not define.

## Process

### 1. Locate the sources and scope the change

From the ticket/path argument, find `docs/plans/<feature>/` and read:

- `<TICKET>-prd.md` — requirements + acceptance criteria + user stories.
- `<TICKET>-plan.md` (or `-implementation-plan.md`) — the tracer-bullet slices, each with its
  "What to build" + AC + approved **`Test floor`** block. The floor is what you audit the tests
  against; the `Test plan approved` marker confirms sign-off.
- `<TICKET>-execution-plan.md` — what shipped per slice, with per-slice **AC coverage** claims (AC →
  named test) to verify, not trust. Both build paths produce this, but it may be **absent** for older
  or out-of-workflow slices — that is expected, not a missing source; audit code + tests directly
  against the plan's `Test floor` and AC.

Identify the worktree the run used (execution-plan header / goal-prompt names it; recall
[[feedback-worktree-terraform]] — work from the per-ticket worktree, not the main repo root) and
compute the changed files:

```
git -C <worktree> diff --stat <base>...HEAD
```

**Hard inputs** are the plan (slices + AC), the PRD, and the changed code. If one of *those* is
missing or the argument is ambiguous, **ask before proceeding** — a wrong path makes every gap wrong.

### 2. Establish the quantitative baseline (run the tooling)

Map the changed files to their workspace(s). For each, run its tests **with coverage** and capture
pass/fail counts + statements/branches/functions/lines for the **changed files** (not the whole
workspace):

```
yarn <ws>.test -- --coverage     # e.g. yarn core.test, yarn site.test, yarn user-hub.test
```

Paste the real output into your notes — it feeds the analysts and the report. An already-failing
suite is a finding; do not fix product code here.

**E2E inventory:** inventory the relevant `site/e2e/` specs and their run status from the **E2E batch
results** block `/e2e-pass` wrote into `<TICKET>-implementation-plan.md` (mirrored into the
execution-plan on a `/goal` build). Record which flows ran, pass/fail, and the AC each covers — so the
analysts can audit e2e usefulness in step 3. Do not run Playwright.

### 3. Fan out the coverage analysts

Build the work list: **one item per slice**, plus **one HOLISTIC item** covering all PRD requirements
together and the seams between slices. Launch the `coverage-analyst` subagent once per item, **in
parallel** (one message, multiple Agent calls). Give each:

- its scope (slice What-to-build + AC, or the holistic requirement set + slice list);
- the PRD requirements / user stories that scope maps to;
- the changed files relevant to it (paths + diff range);
- the existing test files/named tests for that area;
- the step-2 coverage baseline + e2e inventory;
- the execution-plan's per-slice "AC coverage" claims, if present (verify, don't trust);
- the slice's approved **`Test floor`** block.

Each analyst returns a structured block: coverage verdict; an **AC→evidence** table (Evidence quotes
the load-bearing assertion; a Mutation column names a product change each Covered test should catch);
a **Floor audit** (each planned floor test: built? useful? + Discovered tests beyond the floor); a
**Gaps** table (each tied to an AC/requirement, severity 1-10); a **Recommended tests** table (each
classified unit / integration / e2e with target file, what it asserts, and a Regression-proof column
for severity ≥7); and any test-quality issues.

### 4. Synthesize the report, then open the selection gate

Merge the analyst outputs into `docs/plans/<feature>/<TICKET>-test-coverage-report.md`, deduping
overlapping recommendations (the holistic pass often restates per-slice gaps — keep one, note the
overlap). Use the structure in [`report-template.md`](report-template.md).

**Write the report to disk FIRST** — before you prompt for anything. The file is the primary
deliverable and it stays regardless of what the user later chooses. **Only then** present the **Gaps**
and **Recommendations** with a one-paragraph readout (headline gaps + how many unit/integration vs
e2e tests are recommended) and **ask which gaps to close**: **all**, a **subset**, or **none** (the
report alone is a valid outcome). If there are **no gaps**, say so and skip to step 6. Implement
nothing before the user answers; on **none** / no-gaps, skip step 5. E2E recommendations are never
implemented here (see step 5).

### 5. Implement the selected recommendations (defer E2E to /e2e-pass)

Work **only the unit/integration recommendations the user selected**, highest severity first. Use
`/tdd`: write the test, paste the failing run (RED), make it pass (`yarn <ws>.test`); if a test
reveals a real product bug, surface it rather than weaken the test.

- **For severity ≥7, run the red→green regression proof** and paste both outputs into the report: with
  the new test green, revert the product hunk it protects → the test **FAILS** → restore → it
  **passes**. A test that still passes with the behavior reverted is hollow — fix the test, don't
  record a false proof. _(regression proof adapted from Superpowers `verification-before-completion`,
  obra/superpowers, MIT — Jesse Vincent.)_
- When the batch is done, re-run with `--coverage` and record the **delta** vs the step-2 baseline.

**E2E:** if the audit found a missing or hollow e2e flow, record it as a recommendation and **defer it
to a targeted `/e2e-pass` re-run** — tell the human which flow is owed. Do not author a `site/e2e/`
spec or run Playwright here.

### 6. Finalize

Update the Recommendations table with each item's outcome (implemented + passing / not selected /
pending human E2E / deferred), append the coverage delta if any tests were built, and give the user a
final summary: what shipped, what they chose not to implement, new test counts, coverage delta, and
the exact E2E steps left for them.

Do **not** fold these results into the PRD/execution-plan now — per [[execplan-doc-foldins-at-merge]],
durable fold-ins happen at merge time via fresh-context review. Commit the new tests + the report to
the branch in the repo's existing subject style (recall [[plain-git-commits]] /
[[multi-repo-branch-check]] — commit in the worktree where the code lives, not orchestration).

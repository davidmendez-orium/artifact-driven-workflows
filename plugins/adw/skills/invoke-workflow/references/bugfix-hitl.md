# Bug-Fix Workflow — Human-in-the-Loop

You are my AI development workflow guide. Walk me through fixing one Jira bug ticket end-to-end using the eight-step, artifact-driven workflow below. This is the HUMAN-IN-THE-LOOP variant: we diagnose and fix TOGETHER with `/tdd` (and `/systematic-debugging` when we're stuck) instead of an autonomous `/goal` run, and you pause for my go-ahead at every step. The work happens in THIS checkout — there is no worktree — so step 0 is what guarantees the bug is diagnosed against a fresh base rather than on top of whatever was left here. Do NOT write any fix code until we have a failing test that reproduces the bug AND I've approved the root cause. Never run ahead of me, and never patch a symptom before we've named the cause.

TICKET: `<TICKET_URL>`
BASE BRANCH: `<BASE_BRANCH>`
EXTRA INSTRUCTIONS FROM ME: <EXTRA_INSTRUCTIONS>

## 0. Start From a Fresh Base

Before reading a single line of this codebase, get onto a known-clean base cut from freshly
fetched `origin/<BASE_BRANCH>`. This matters more for a bug than for a feature: the "bug" you
reproduce on a dirty tree can be someone else's uncommitted work, and the root cause you name
then gets attributed to `<BASE_BRANCH>`.

- **Refuse to start on a dirty tree.** Run `git status --porcelain`; if it prints anything, STOP
  and show me. Do not stash, do not commit, do not work around it — uncommitted changes here are
  either mine or another ticket's, and both are mine to resolve, not yours.
- **Fetch the base and report it:**
  ```bash
  git fetch origin <BASE_BRANCH>
  git rev-parse --short origin/<BASE_BRANCH>
  ```
  Tell me the resolved SHA and its commit subject, so we agree on what "fresh" means today.
- **Cut the working branch** from the fetched base, using this repo's own naming convention:
  `git switch -c <branch-name> origin/<BASE_BRANCH>`. Confirm the branch name and a clean
  `git status` before moving on.
- **If I'm already on the right branch** for this ticket (a resumed run), say so instead of
  creating a second one, and report the drift
  (`git rev-list --left-right --count origin/<BASE_BRANCH>...HEAD`). I decide whether to rebase.
- **If the base branch doesn't exist on the remote**, STOP and tell me — do not silently fall
  back to `main` or to a local branch of the same name.
- **A repro confirmed before this step doesn't count.** If you already reproduced the bug on the
  tree as you found it, re-confirm it here on the fresh base and tell me if the answer changed.

## 1. Gather Context & Confirm the Repro

Run `/fetch-from-jira <TICKET-URL>`. It fetches the ticket, follows every linked reference one hop (Confluence, linked Jira, Drive/Docs, Figma, GitHub — plus any linked incident, error log, Sentry/monitoring link, or offending PR), writes everything verbatim into `docs/plans/<TICKET-ID>-<slug>/raw/`, and gives you an `_INDEX.md` plus a `_GAPS-manual-provide.md` for anything it couldn't reach.

Then, the core of this step: walk the stated repro steps yourself and confirm they are accurate and still true. Explicitly report one of:

- (a) reproduces as written,
- (b) reproduces only with different/extra steps (state them), or
- (c) no longer reproducible.

Capture the ACTUAL observed failure (error text, wrong output, stack trace, screenshot) and the EXPECTED correct behaviour side by side. Review the gaps list and supply any missing artifacts before moving on. Do not proceed past a bug we can't reproduce — surface that and stop.

## 2. `/grill-with-docs` — Locate the Root Cause

Stress-test your hypothesis against the domain model. Ask questions one at a time, waiting for my answer before moving to the next branch; stop when we've isolated the cause, not just the symptom. If the cause is elusive or we're guessing, invoke `/systematic-debugging` to force a root-cause-first path (bisect, add instrumentation, form and test one hypothesis at a time) before any code changes. Update repo docs as we learn.

THEN, in the same session, run `/to-prd`: it identifies the test seam that will pin this bug (checking with me it's the right one), then writes and publishes a durable `<ticket>-prd.md` describing WHAT is broken and what correct behaviour looks like — the confirmed repro, the root cause, the blast radius (what else this cause could affect), and any regression risk — plus a Testing Decisions section recording the agreed seam and the level of the reproducing test.

## 3. `/to-issues` (in a NEW context) — Fix Plan

From the ticket number or PRD path, produce a minimal, surgical fix plan (the HOW). For most bugs this is a single vertical slice; split only if the root cause spans layers. Each slice carries its own acceptance criteria (the bug no longer reproduces + correct behaviour), blockers, AND a test floor: the reproducing test first (mandatory level: unit/integration/e2e), plus any regression tests for adjacent behaviour the fix could disturb.

Grill the test plan — especially "what nearby thing might this fix break?" — and, on my sign-off, write a plan-level "Test plan approved" marker. STOP and let me read and approve it. (No `/to-goal-prompt` needed — we are not running `/goal`.)

## 3.5. PR Strategy

The fix plan is approved and no code is written yet, so settle now how its slices become PRs. Count the approved slices:

- **Three or fewer — don't ask.** Say in one line that this files as a single PR, and move on. Almost every bug fix is one slice and one PR; a stack of small PRs costs a reviewer more ordering overhead than it saves in diff size.
- **Four or more — ask me ONCE** (`AskUserQuestion`) and wait for the answer:
  - **One PR** (recommended) — every slice commits onto the single working branch.
  - **Stacked PRs** — one branch per slice, each cut from the previous, each PR targeting the branch below it. Reviewers get review-sized diffs in dependency order, and each PR retargets to `<BASE_BRANCH>` as its parent merges. Worth the overhead only when the fix is genuinely large.
  - **Separate non-stacked PRs** — one branch per slice, every branch cut from `<BASE_BRANCH>` and targeting it. Honest only if no slice imports another: check the import direction between slices first, and tell me if a stack is the truthful answer instead.
- **Record the answer** as a one-line `PR strategy:` entry in the fix plan, so step 4 and step 8 read one decision rather than each re-deriving it.

Ask this once. Do not re-raise it at step 8, and do not silently change it because the diff came out bigger or smaller than planned — if you think the answer has stopped fitting, say so and let me decide.

**What the answer changes downstream:**

- **One PR** (and every plan of three slices or fewer) — step 4 is unchanged: commit per slice onto the one working branch.
- **Stacked** — at step 4, before starting slice `i`, cut its branch from slice `i-1`'s branch (slice 1 from `<BASE_BRANCH>`) with `git switch -c <TICKET-ID>-part<i>-<slug> <previous-branch>`, and commit that slice's work there. Once a slice branch has a child built on it, never rebase it and never force-push it — the child is built on that history.
- **Separate** — the same branch-per-slice, except every branch is cut from `origin/<BASE_BRANCH>`.

## 4. Fix with `/tdd` — Red First, Always

Slice by slice, TOGETHER, in this session. The reproducing test leads: write ONE failing test that captures the bug, RUN it, and SHOW me the red — this is the proof we've actually reproduced it in code (paste the failing output). Then write the MINIMAL fix to go green and show me the green. Match existing style; touch only what the root cause requires — no opportunistic refactors riding along with the fix. Add the agreed regression tests and keep them green.

Pause for my review at each slice boundary. E2E reproductions are OWED to step 5 (`/e2e-pass`) — only unit/integration tests are built here. Commit per slice, with the fix and its reproducing test in the same commit.

## 5. `/e2e-pass` (in a NEW, context-cleared session, after the fix is green)

Author + run the e2e batch. Collect every owed e2e floor row, optionally GRILL the feature docs + fix for user-visible journeys the bug touched (I bypass, or approve/skip each — approved ones get appended to the slice's test floor), author the specs under this repo's own e2e directory (find it — do not invent a location) as whole cross-slice journeys that exercise the once-broken path end to end, then boot the stack + establish the auth session and run the suite once, recording pass/fail back into the fix plan.

## 6. `/to-coverage-report` — Regression Audit

Fan out agents to audit unit + E2E coverage against the acceptance criteria and test floor, checking test USEFULNESS (quote the load-bearing assertion; name the exact mutation — i.e. the original bug — it would catch; a test that passes even with the bug reintroduced is a gap, not coverage). Confirm the reproducing test genuinely fails without the fix. Report gaps and blast-radius holes and we close them together. It AUDITS the e2e specs from step 5 but does NOT run them; any missing/hollow e2e flow defers back to a targeted `/e2e-pass` re-run.

## 7. `/documentation-gardening`

Before we open the PR, consolidate the markdown this ticket sprawled (plans, root-cause notes, the PRD + execution log): one canonical home per fact, supersession made explicit, cross-links fixed, durable facts harvested out of the planning husks. Capture the root cause and the fix as a lasting note (an ADR or the feature spec's "known failure modes"), so the next person hits the lesson, not the bug. Grow the consolidated feature-level spec (`docs/specs/<feature>.md`) so the corrected behaviour is now the documented WHAT. Analyse and propose first; change nothing without my per-item approval.

**Caveat — thin fixes:** if the fix is thin and not an architectural decision, skipping ADR creation is allowed. But the docs-consolidation pass is NOT optional — still harvest the durable facts into a canonical home, grow/point at the feature-level spec, fix cross-links, and retire the husks. A skipped ADR is never an excuse to skip consolidation; the lesson must still land somewhere durable (a feature spec's "known failure modes", not just a plan doc).

## 8. Hand Back

Stop here so I can commit, manually re-run the original repro to confirm it's dead, and push the PR.

**If I ask YOU to open the PR, prove it still merges first.** Handing back is the default and normally you stop here — but when I do hand PR creation to you, run one gate before the first `gh pr create`: every branch you are about to open must still merge cleanly into the base it targets. The base you cut from at step 0 is hours or days old by now, and `gh pr create` does not care — GitHub opens a conflicted PR exactly as happily as a clean one, and the conflict then surfaces to a reviewer instead of to us.

```bash
git fetch origin <BASE_BRANCH>
git merge-tree --write-tree --name-only origin/<BASE_BRANCH> <branch-being-opened>
```

Exit 0 means it merges clean, and the only output is a tree OID. Exit 1 means conflict, and the lines between that OID and the first blank line are the conflicting paths. Neither outcome writes the working tree, the index or HEAD, so this is safe to run at any point. (`--write-tree` needs git ≥ 2.38. If this repo's git is older, fall back to `git merge --no-commit --no-ff origin/<BASE_BRANCH>` followed by `git merge --abort` — but that one DOES touch the working tree, so never run it on a dirty one.)

Check **every** branch you are about to open, each against the base it actually targets: for a stack, slice `i` against slice `i-1` (slice 1 against `origin/<BASE_BRANCH>`); for separate PRs, every branch against `origin/<BASE_BRANCH>`. If any one of them conflicts, open **none** of them — a stack whose lower slice is conflicted makes every PR above it wrong too.

On a conflict, STOP and tell me the branch, the conflicting paths, and the base SHA you checked against. Then ask me how to resolve it — rebase onto the fresh base, merge the base in, or leave it to me — and wait. Do not resolve it yourself, and never force-push a slice branch that already has a child built on it. On a clean result, say which base SHA you checked against, then open the PRs.

If the PR Strategy step recorded **Stacked** or **Separate**, hand back the whole set rather than one PR. List the slice branches in merge order and, for each, the exact line that opens it — `gh pr create --base <the branch below it>` for a stack, `gh pr create --base <BASE_BRANCH>` for separate PRs — titled `<TICKET-ID> [i/N] <short-description>`. Draft a body for every branch, not just the last: each one covers its own slice, carries the full ticket acceptance criteria prefixed "this PR is part i of N toward these criteria", and ends with the Core Claims section below scoped to that slice's own diff. Once the PR numbers exist, add to each body a stack map listing all N in merge order with the current one marked. Say plainly that a stack is merged bottom-up, because merging out of order breaks the retarget chain.

**PR body standard — the "Core Claims" section (Developers AND agents, effective now):**

Every PR body ends with a **Core Claims** section, written before the first reviewer is assigned. A reviewer handed no invariants returns docblock nits; a reviewer handed falsifiable claims goes looking for the one that breaks. It is a falsification brief, not a summary:

1. **Context — 3 lines max.** The data flow the change sits in, so a reviewer knows what "wrong" would look like.
2. **Claims, hardest first, numbered.** Each one falsifiable sentence about behaviour ("during a dry run, no write reaches any downstream system"), followed by *the cheapest way to break it* — the specific paths and failure modes you want attacked (the retry task, the 409-recovery path, off-by-one on the line offset, the second file, the boundary value). A claim with no attack surface named is a summary bullet; move it up to Changes.
3. **Known-intentional exceptions.** The things that look like violations and aren't ("these two raw-email reads are reads only"). Declaring them buys real findings instead of a round-trip on false positives.
4. **Traps.** Any test that would pass while the feature is broken (a mock factory stubbing the predicate under test), and how to read this repo's runner — check its passed-suite count (jest, for example, reports `numPassedTestSuites`), not the summary line; a suite that fails to LOAD reports as fewer passes, not as a failure.
5. **Out of scope.** Already-merged infra, gitignored scratch dirs, files the diff touches only for formatting. Name them, or the review spends its budget outside your diff.
6. **Behaviour changes the ticket didn't ask for.** Anything in the diff beyond the ticket's scope, called out by name — a reviewer having to discover it is the cheap version; QA discovering it in UAT is not.

**Reviewer contract — include verbatim, it is the half that does the work:**

> Run the review your own instructions define, in full — this section adds work, it does not replace or narrow your scope. On top of that: read the code and do not trust these claims; your job is to falsify them. Per claim return **UPHELD / REFUTED / UNVERIFIABLE** plus the `file:line` of the guard that makes it true, or of the path that breaks it. A restatement of the claim is not evidence. Every finding must anchor to a line in this diff; pre-existing problems get one line under "Adjacent — not this PR" with no suggested fix. No praise, no overall grade.

Claims are a floor added to the reviewer's normal scope, never a substitute for it, and the diff is the boundary: run the review you would have run, answer every claim, then keep going within the changed lines. Both halves of the contract are load-bearing — "in full" is what keeps the reviewer's own scope intact, and the per-claim verdict plus `file:line` is what keeps the claim list from being read as an answer key and returned all-green.

Where this rule came from: one PR, one claim list, two reviewers. The reviewer that returned per-claim verdicts with `file:line` found a silent-failure blocker — a production run that would have processed zero records while reporting success. The reviewer handed the same claims without the verdict requirement returned all-green. And the first reviewer's two best findings sat outside the claims and inside the diff, which is what "in full" is protecting.

**QA hand-off policy — Developers AND agents, effective now:**

Before assigning to QA: your ticket needs a "How to test" comment that meets the standard below.
If test steps are missing or incomplete: QA will reassign the ticket to you and move it to To Do. Fix, and re-assign. QA will also move/reassign the ticket when their testing fails.

**"How to test" comment — the standard** (post as a single comment on the ticket before assigning to QA):

1. **PR link** — the PR(s) implementing the fix.
2. **Preconditions & setup** — the account / state / seed data to start from, plus any env gotchas that would otherwise produce a misleading failure (e.g. which system is authoritative for a field, required API keys).
3. **Per-AC steps** — one entry per acceptance criterion, labelled with the AC it covers, each a concrete action → explicit expected result. For a bug, the primary AC is "original repro no longer reproduces + correct behaviour."
4. **Regression checks** — the adjacent behaviour the change could disturb, confirmed unchanged.
5. **Automated checks** — the exact test/lint commands to run (targeted paths), stated as all-green.

---

Begin with step 0. Ask me for the ticket URL, confirm the ticket AND the base branch
(`<BASE_BRANCH>`) with me, get onto a fresh base, then go.

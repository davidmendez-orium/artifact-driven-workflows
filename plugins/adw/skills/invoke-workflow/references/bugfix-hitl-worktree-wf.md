# Bug-Fix Workflow — Human-in-the-Loop (Isolated Worktree variant)

You are my AI development workflow guide. Walk me through fixing one Jira bug ticket end-to-end using the eight-step, artifact-driven workflow below. This is the HUMAN-IN-THE-LOOP + ISOLATED-WORKTREE variant: we diagnose and fix TOGETHER with `/tdd` (and `/systematic-debugging` when we're stuck) instead of an autonomous `/goal` run, you pause for my go-ahead at every step, AND all analysis and build/test/commit work happens in a git worktree cut off freshly fetched `origin/<BASE_BRANCH>`, never in whatever checkout you happen to be sitting in. That lands in two parts: a **thin read-only checkout at step 0** so the diagnosis is never done on a dirty tree, and the **full worktree setup at step 3.5** once the fix plan is approved. Do NOT write any fix code until we have a failing test that reproduces the bug AND I've approved the root cause. Never run ahead of me, and never patch a symptom before we've named the cause.

TICKET: `<TICKET_URL>`
BASE BRANCH: `<BASE_BRANCH>`
EXTRA INSTRUCTIONS FROM ME: <EXTRA_INSTRUCTIONS>

## 0. Cut a Clean Analysis Checkout off Fresh `<BASE_BRANCH>`

Before reading a single line of this codebase, get onto a known-clean base. The checkout you
happen to be sitting in may carry another ticket's uncommitted changes, a stale local `<BASE_BRANCH>`, or
a half-finished branch — and a diagnosis done on top of that dirt is worse than no diagnosis: the
"bug" you reproduce can be someone else's WIP, and the root cause you name gets attributed to
`<BASE_BRANCH>`. A worktree cut later cannot retroactively clean the analysis it was based on.

This step is deliberately **thin** — a checkout and nothing else. No isolated ports, no env file,
no dependency install, no databases. All of that is real setup cost, and it waits for step 3.5,
after the ticket has survived the repro gate and the fix plan is approved.

```bash
git fetch origin <BASE_BRANCH>
git worktree add --detach .worktrees/<TICKET-ID>-analysis origin/<BASE_BRANCH>
```

- **Detached on purpose.** No branch is created here, so step 3.5 stays free to cut the real
  working branch under whatever naming convention this repo uses. Treat this tree as **read-only**: read code, search,
  trace, diff against history. Do not commit in it, and do not write the fix here.
- **Confirm the base.** Report the resolved `origin/<BASE_BRANCH>` SHA and that `git status` in the new
  tree is clean. If it isn't, STOP — that is the exact failure this step exists to prevent.
- **This is the one hand-rolled `git worktree add` in this workflow, and it is allowed only
  because it is read-only.** Step 3.5's prohibition on hand-rolling exists because a hand-made
  worktree lacks the isolated ports and env wiring — which only bites once you *run* something. A
  detached checkout that never boots a service can't hit that failure. The moment we need to run
  the stack, we use `/create-worktree` (see step 1's promotion rule and step 3.5).
- Plan docs still live where you invoked this workflow from — `docs/plans/<TICKET-ID>-<slug>/` in the planning workspace — never in this tree.

## 1. Gather Context & Confirm the Repro

Run `/fetch-from-jira <TICKET-URL>`. It fetches the ticket, follows every linked reference one hop (Confluence, linked Jira, Drive/Docs, Figma, GitHub — plus any linked incident, error log, Sentry/monitoring link, or offending PR), writes everything verbatim into `docs/plans/<TICKET-ID>-<slug>/raw/`, and gives you an `_INDEX.md` plus a `_GAPS-manual-provide.md` for anything it couldn't reach.

Then, the core of this step: walk the stated repro steps yourself and confirm they are accurate and still true. Explicitly report one of:

- (a) reproduces as written,
- (b) reproduces only with different/extra steps (state them), or
- (c) no longer reproducible.

Capture the ACTUAL observed failure (error text, wrong output, stack trace, screenshot) and the EXPECTED correct behaviour side by side. Review the gaps list and supply any missing artifacts before moving on. Do not proceed past a bug we can't reproduce — surface that and stop.

**Promotion rule — when the repro needs a running stack.** Step 0's checkout has no `.env`, no
isolated ports and no dependencies, so it can only support a *code-level* repro (reading the offending
path, a stack trace, a failing existing test, a log or Sentry payload). If confirming this
particular bug requires booting services or clicking through the app, say so and **promote step
3.5 to here**: run `/create-worktree` now, walk the repro inside the real worktree, and treat 3.5
as already done when you reach it. Do NOT walk a stack-dependent repro in the analysis checkout,
and do NOT walk it in the main checkout to avoid the promotion — a repro confirmed on a dirty
tree is the thing this workflow is built to prevent. Tell me which path you took.

## 2. `/grill-with-docs` — Locate the Root Cause

Stress-test your hypothesis against the domain model. Ask questions one at a time, waiting for my answer before moving to the next branch; stop when we've isolated the cause, not just the symptom. If the cause is elusive or we're guessing, invoke `/systematic-debugging` to force a root-cause-first path (bisect, add instrumentation, form and test one hypothesis at a time) before any code changes. Update repo docs as we learn.

THEN, in the same session, run `/to-prd`: it identifies the test seam that will pin this bug (checking with me it's the right one), then writes and publishes a durable `<ticket>-prd.md` describing WHAT is broken and what correct behaviour looks like — the confirmed repro, the root cause, the blast radius (what else this cause could affect), and any regression risk — plus a Testing Decisions section recording the agreed seam and the level of the reproducing test.

## 3. `/to-issues` (in a NEW context) — Fix Plan

From the ticket number or PRD path, produce a minimal, surgical fix plan (the HOW). For most bugs this is a single vertical slice; split only if the root cause spans layers. Each slice carries its own acceptance criteria (the bug no longer reproduces + correct behaviour), blockers, AND a test floor: the reproducing test first (mandatory level: unit/integration/e2e), plus any regression tests for adjacent behaviour the fix could disturb.

Grill the test plan — especially "what nearby thing might this fix break?" — and, on my sign-off, write a plan-level "Test plan approved" marker. STOP and let me read and approve it. (No `/to-goal-prompt` needed — we are not running `/goal`.)

## 3.5. Full Worktree Setup — run `/create-worktree`

The fix plan is approved and we're about to write code, so now pay the real setup cost. (Skip
this step only if step 1's promotion rule already ran it — in that case say so and move on.)

**Use the `/create-worktree` skill. Do NOT hand-roll `git worktree add`.** Whatever this project's copy does specifically, it owns the parts that silently break a hand-made worktree: branching from a just-fetched `origin/<BASE_BRANCH>` instead of a stale local `<BASE_BRANCH>`, **per-worktree environment config** so parallel worktrees don't fight over the same ports, databases or fixtures, a real dependency install and whatever setup task the project needs before it will boot, this session's already-approved permissions carried into the new tree, and any start/stop scripts plus orientation notes the project's agents rely on. Step 0's checkout has none of these — it was never meant to.

1. **Run `/create-worktree <TICKET-ID>-<slug>`** and answer its questions (which repos to include, new branch vs. existing). By now step 1 has fetched the ticket, so the `<slug>` is known. It creates the worktree under `.worktrees/<TICKET-ID>-<slug>` in each selected repo and prints the absolute paths. **Tell it the base:** this run is based on `<BASE_BRANCH>`, so the worktree must be cut from `origin/<BASE_BRANCH>`. If `/create-worktree` assumes `main` and offers no way to say otherwise, STOP and tell me rather than accepting a worktree cut from the wrong base — every commit afterwards inherits it.
2. **Confirm it branched from a just-fetched `origin/<BASE_BRANCH>`**, not a local `<BASE_BRANCH>`, and that the new tree is clean.
3. **Retire the step-0 analysis checkout** — it has served its purpose and a stale second tree is a trap for the next agent that greps for the file it just edited:
   ```bash
   git worktree remove .worktrees/<TICKET-ID>-analysis
   ```
   If it refuses because something was written there against instructions, show me what before removing anything.
4. **Report the new paths back to me** before doing anything else.
5. **LEAVE this ticket's plan docs where they are**, in the planning workspace's `docs/plans/<TICKET-ID>-<slug>/`. Do **NOT** move or copy them into the worktree, and never commit them to the code repo — the ROOT-CAUSE doc, fix plan and the fetched `raw/` sources are planning ephemera, and a small fix arriving as a 45-file diff spends the reviewer's budget outside the code. The durable output is the `AGENTS.md` gotcha (+ a `CONTEXT.md` term if warranted) that the gardening step produces; git history and the PR body preserve the rest. Note the code repo may already contain committed `docs/plans/<ticket>/` folders from other authors — that is not precedent to follow.

If `/create-worktree` cannot be found, or it reports a repo it needs as NOT FOUND, STOP and tell me — do not substitute a hand-made worktree. One missing the per-worktree env wiring works right up until it fails in a way that costs an afternoon to diagnose. This project may not have a `/create-worktree` skill at all; if it doesn't, say so and let me choose between installing one and dropping to the non-worktree variant of this workflow.

From here on, ALL build / test / commit work happens **inside the worktree**.

## 3.6. PR Strategy

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
- **Stacked** — at step 4, before starting slice `i`, cut its branch, inside the worktree, from slice `i-1`'s branch (slice 1 from `<BASE_BRANCH>`) with `git switch -c <TICKET-ID>-part<i>-<slug> <previous-branch>`, and commit that slice's work there. Once a slice branch has a child built on it, never rebase it and never force-push it — the child is built on that history.
- **Separate** — the same branch-per-slice, except every branch is cut from `origin/<BASE_BRANCH>`.

## 4. Fix with `/tdd` — Red First, Always

Slice by slice, TOGETHER, in this session, inside the worktree. The reproducing test leads: write ONE failing test that captures the bug, RUN it, and SHOW me the red — this is the proof we've actually reproduced it in code (paste the failing output). Then write the MINIMAL fix to go green and show me the green. Match existing style; touch only what the root cause requires — no opportunistic refactors riding along with the fix. Add the agreed regression tests and keep them green.

Pause for my review at each slice boundary. E2E reproductions are OWED to step 5 (`/e2e-pass`) — only unit/integration tests are built here. Commit per slice, with the fix and its reproducing test in the same commit.

## 5. `/e2e-pass` (in a NEW, context-cleared session, after the fix is green)

Author + run the e2e batch. Collect every owed e2e floor row, optionally GRILL the feature docs + fix for user-visible journeys the bug touched (I bypass, or approve/skip each — approved ones get appended to the slice's test floor), author the specs under this repo's own e2e directory (find it — do not invent a location) as whole cross-slice journeys that exercise the once-broken path end to end, then boot the stack + establish the auth session and run the suite once, recording pass/fail back into the fix plan. Run inside the worktree.

## 6. `/to-coverage-report` — Regression Audit

Fan out agents to audit unit + E2E coverage against the acceptance criteria and test floor, checking test USEFULNESS (quote the load-bearing assertion; name the exact mutation — i.e. the original bug — it would catch; a test that passes even with the bug reintroduced is a gap, not coverage). Confirm the reproducing test genuinely fails without the fix. Report gaps and blast-radius holes and we close them together. It AUDITS the e2e specs from step 5 but does NOT run them; any missing/hollow e2e flow defers back to a targeted `/e2e-pass` re-run.

## 7. `/documentation-gardening`

Before we open the PR, consolidate the markdown this ticket sprawled (plans, root-cause notes, the PRD + execution log): one canonical home per fact, supersession made explicit, cross-links fixed, durable facts harvested out of the planning husks. Capture the root cause and the fix as a lasting note (an ADR or the feature spec's "known failure modes"), so the next person hits the lesson, not the bug. Grow the consolidated feature-level spec (`docs/specs/<feature>.md`) so the corrected behaviour is now the documented WHAT. Analyse and propose first; change nothing without my per-item approval.

**Caveat — thin fixes:** if the fix is thin and not an architectural decision, skipping ADR creation is allowed. But the docs-consolidation pass is NOT optional — still harvest the durable facts into a canonical home, grow/point at the feature-level spec, fix cross-links, and retire the husks. A skipped ADR is never an excuse to skip consolidation; the lesson must still land somewhere durable (a feature spec's "known failure modes", not just a plan doc).

## 8. Hand Back

Stop here so I can commit, manually re-run the original repro to confirm it's dead, and push the PR from the worktree.

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
(`<BASE_BRANCH>`) with me, cut the clean analysis checkout, then go.

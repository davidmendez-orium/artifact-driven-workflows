---
category: documentation
name: e2e-pass
description: Author and run the batched Playwright end-to-end suite once, after all slices are built — collect every owed e2e floor row, optionally grill the feature docs + implementation for more, author the specs as whole cross-slice journeys, then boot the stack, establish the auth session, and run the suite. The e2e step of the chain — to-prd → to-issues → to-goal-prompt → /goal (or /tdd) → e2e-pass → to-coverage-report.
argument-hint: '<ticket key, or path to the plan dir / implementation-plan.md>'
disable-model-invocation: true
---

# E2E Pass

This skill owns **the e2e batch** — the single, human-gated end-to-end run that happens **once,
after the whole feature is assembled**. Every `Level: e2e` row in the slices' test floors is **owed**
to this batch: the build (`/goal` or `/tdd`) records the owed rows but authors and runs none of them,
because e2e flows span slices and can only be written as whole journeys once all slices exist. Run
this in a **fresh, context-cleared session** after the last slice is done, before `/to-coverage-report`.

Any commands shown below are **illustrative, not this project's**. Discover the real e2e runner,
its spec directory and its invocation first — the package/build manifest's scripts, the runner's own
config file — and substitute. Never run a command from an example that this repo does not define.

## Process

### 1. Collect the owed e2e

From the ticket/path argument, find the plan directory `docs/plans/<feature>/` and read:

- `<TICKET>-implementation-plan.md` (or `-plan.md`) — every slice's **`Test floor`** block. Collect
  **every row whose `Level` is `e2e`** — these are the owed flows.
- `<TICKET>-execution-plan.md` _(optional — only exists for `/goal` runs)_ — any
  `Needs-E2E-run: owed` markers the build left per slice.

Build the **batch list**: one entry per owed flow → `{ flow, the AC it pins, target spec under
site/e2e/, the load-bearing assertion it must make }`.

**Completion:** every `Level: e2e` floor row across all slices appears in the batch list with a
target spec + assertion; none dropped. If the plan or its `Test floor` is missing, or the path is
ambiguous, **ask before proceeding** — a wrong path makes the whole batch wrong.

### 2. (Optional) Grill for more e2e

Ask the user whether to grill for end-to-end coverage **beyond the floor**. Two paths:

- **Bypass** — skip; the batch is exactly the owed rows from step 1.
- **Grill** — read **all** the feature docs (the consolidated spec / `<TICKET>-prd.md`, the
  implementation plan, the execution plan) **and the actual implementation** (the changed code +
  the existing specs under `site/e2e/`), then propose end-to-end flows the floor does **not** cover:
  cross-slice journeys, auth / permission variants, and error or edge paths a real user can hit.
  Present them **one at a time** — each proposed flow is one decision, with your recommended answer
  shown; the user **approves or skips** each, and you **wait for the call** before the next.

For each **approved** flow: append it to the relevant slice's `Test floor` in
`<TICKET>-implementation-plan.md` as a new row (`Level: e2e`, tagged `added: e2e-pass grill`), so the
human-approved test contract stays the **single source of truth** — then add it to the batch list.

**Completion:** the user has bypassed, or every proposed flow is approved (and appended to the floor)
or skipped; the batch list reflects those decisions.

### 3. Author the specs

For every flow in the batch list, write/finish its spec under `site/e2e/`, mirroring the existing
specs (tags, `storageState`, fixtures). Author **cross-slice flows as whole user journeys**, not
per-slice fragments. Each spec must make the load-bearing assertion recorded for its flow.

**Completion:** every batch-list flow has a spec file that asserts its recorded behaviour; no owed or
approved flow is left unwritten.

### 4. Boot the stack + establish the auth session

E2e needs a live stack and a real authenticated session, established **here, after implementation —
never before**. Detect, don't hardcode:

- if `./dev-start.sh` exists in the current worktree → run it;
- otherwise (main worktree) → bring up the full stack = **seeded DB + services**: `docker-compose up`
  (DB seeded with data) + each service's dev command, discovered from `docker-compose.yml` + the
  `package.json` dev scripts (a reachable worktree's `dev-start.sh` is the service-list source of
  truth). Verify the exact list against the real repo before running — so `E2E_BASE_URL` (default
  `http://localhost:3000`) is live.

Then run the one-time interactive auth flow: `yarn site.test:e2e:auth-setup` (or the repo equivalent)
— it opens a headed browser; log in through the Ory OAuth redirect; it saves the session to
`site/e2e/.auth/user.json` (gitignored). Required env may include `E2E_ORY_ORIGIN` and, for cart
specs, `E2E_PRODUCT_URL` (see `site/.env.test.local.example`).

**Completion:** the stack is live at `E2E_BASE_URL` and `site/e2e/.auth/user.json` is present.

### 5. Run the batch + report

Run the full e2e suite **once**: `yarn site.test:e2e` (or the relevant grep). Report pass/fail **per
spec**, mapped back to the AC each flow pins. For any failure, classify it — never silently weaken a
spec to make it pass:

- **Product bug** — the code violates the AC's recorded behaviour. The spec stays; surface the bug.
- **Spec bug** — the assertion contradicts the AC's recorded behaviour. Fix the spec, not the AC.

Append an **E2E batch results** block to `<TICKET>-implementation-plan.md` (the always-present record,
next to the slices' `Test floor`): each spec → pass/fail → the AC it covers, with every owed flow
updated `owed` → `run: pass` / `run: fail`. If a `<TICKET>-execution-plan.md` exists (a `/goal`
build), mirror the same block there too.

**Completion:** the suite ran once; every batch-list flow has a pass/fail recorded against its AC; the
owed markers are updated.

Then hand to **`/to-coverage-report`** (step 6): it audits this e2e for **usefulness, not just
presence**, alongside unit/integration coverage. Any e2e gap it finds comes **back here** for a
targeted re-run — `/to-coverage-report` never authors or runs e2e itself.

---
category: documentation
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices.
disable-model-invocation: true
---

# To Issues

Break a plan into independently-grabbable issues using vertical slices (tracer bullets), then grill
and sign off the per-slice test floor.

- **Plan file:** a new `<Ticket>-implementation-plan.md` in the same directory as the PRD you're
  working from.
- **Triage label:** `triage/ready-for-afk` (these issues are ready for AFK agents).
- **The test floor is the contract.** Each slice's `Test floor` is the signed-off test plan a headless
  `/goal` run executes with nobody else grilling it. It is the source of truth — drafted here, grilled
  + signed off here (step 4), and audited against by `to-coverage-report`. The `/goal` context pack is
  a regenerated distillation and must never hold the contract.

## Process

### 1. Gather context

Work from whatever is already in the conversation. If the user passes an issue reference (number, URL,
or path), fetch it and read its full body + comments.

### 2. Explore the codebase

If you haven't already, explore to understand the current state. Issue titles/descriptions use the
project's domain glossary and respect ADRs in the area you're touching. Look for prefactoring that
makes the implementation easier — "make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each is a thin vertical slice cutting through ALL
integration layers end-to-end, NOT a horizontal slice of one layer.

- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests).
- A completed slice is demoable or verifiable on its own.
- Any prefactoring is done first.
- **Right-size to a test cycle.** A slice is the smallest unit that carries its own red→green cycle —
  small enough that its test floor is a short, concrete list, large enough to be a complete vertical
  path. If a slice's floor sprawls past a handful of behaviors, split it; if a slice has no behavior
  worth a failing test first, it's not a slice.

### 4. Quiz the user, then grill the test floor + sign off (HARD GATE)

Present the proposed breakdown as a numbered list. For each slice show **Title**, **Blocked by**,
**User stories covered** (if the source has them), and the **Test floor** — the slice's Tests block
(each behavior + its `Level`, format in [`reference.md`](reference.md)), drafted here so granularity
is judged against a real test cycle, not a title. Ask: is the granularity right (too coarse / too
fine)? Are the dependencies correct? Should any slices merge or split? Iterate until approved.

Then grill the floor — this is the gate, before any issue is published or any code is written:

- Walk **every slice's Test floor**. For each row challenge: does this test pin the AC it claims? Is
  the `Level` right (would a cheaper level honestly prove it; does a seam need integration not unit)?
  Is the "Must assert" **load-bearing** — would it _fail if the behavior broke_, or merely assert
  existence? Is any AC left with no row? Is `Level` filled on every row?
- Fix rows inline as they resolve — don't batch. Iterate until the user approves.

**On sign-off**, write a single **plan-level** marker at the very top of the implementation plan:

```
Test plan approved: <name> — <YYYY-MM-DD>
```

This marker is what `to-goal-prompt`'s pre-flight gate checks — no marker → no `/goal` run. Directly
after it, write the **master slice checklist** (`## Slices`, format in `reference.md`). For later test
changes, follow the **adjustment policy** in `reference.md` (stamp minor deltas; recommend a redo only
when the plan/AC itself is wrong) — the marker is a baseline, never auto-invalidated.

_(HARD-GATE + slice-sizing patterns adapted from Superpowers brainstorming / `writing-plans`,
obra/superpowers, MIT — Jesse Vincent — scoped here to the test plan.)_

### 5. Publish the issues to the issue tracker

For each approved slice, publish a new issue using the body template in [`reference.md`](reference.md),
with the `triage/ready-for-afk` label unless instructed otherwise. Publish in dependency order
(blockers first) so "Blocked by" can reference real issue identifiers. Do NOT close or modify any
parent issue.

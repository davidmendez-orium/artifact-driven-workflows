---
name: tdd
description: Test-driven development with red-green-refactor loop. Use when user wants to build features or fix bugs using TDD, mentions "red-green-refactor", wants integration tests, or asks for test-first development.
---

# Test-Driven Development

## The Iron Law

> **NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**
>
> Write the test → **run it and watch it fail** (RED) → write the minimum code to pass (GREEN) →
> refactor. You must have _seen_ the test fail for the right reason before writing the code that makes
> it pass. A test you never watched fail proves nothing — it might pass against broken code.
>
> _Iron Law + the rationalization table below adapted from Superpowers `test-driven-development`
> (obra/superpowers, MIT — Jesse Vincent)._

### Rationalizations that mean you're about to skip the law (reject all of them)

| "Just this once…"                            | Reality                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "This change is too simple to test."         | Simple changes break too; the test takes seconds. Write it.                                |
| "I'll add the test right after."             | After = never, or a test reverse-engineered to pass. Test first.                           |
| "I already know it works."                   | Then the test passes immediately — so writing it costs nothing and proves it.              |
| "It's just config / a one-liner / a rename." | If it can break behavior, it gets a test. If it genuinely can't, there's nothing to write. |
| "Testing this is hard to set up."            | Hard-to-test is a design smell — fix the seam, don't skip the test.                        |
| "I'll lose my flow."                         | RED→GREEN _is_ the flow. Watching it fail is the fastest feedback you have.                |

If you catch yourself reaching for one of these, stop and write the failing test.

## Philosophy

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification - "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" - treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

**Correct approach**: Vertical slices via tracer bullets. One test → one implementation → repeat. Each test responds to what you learned from the previous cycle. Because you just wrote the code, you know exactly what behavior matters and how to verify it.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## Workflow

### 1. Planning

When exploring the codebase, use the project's domain glossary so that test names and interface vocabulary match the project's language, and respect ADRs in the area you're touching.

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for [deep modules](deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing about the system:

```
RED:   Write test for first behavior → RUN IT → watch it fail (for the right reason)
GREEN: Write minimal code to pass → run it → test passes
```

This is your tracer bullet - proves the path works end-to-end. **Verify RED before writing code:** a
test that passes the moment you write it is testing nothing, or the behavior already exists. In a
headless `/goal` run, the failing run must be _pasted into the transcript_ before the implementing
commit — that is the only proof RED happened.

### 3. Incremental Loop

For each remaining behavior:

```
RED:   Write next test → fails
GREEN: Minimal code to pass → passes
```

Rules:

- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior

### 4. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```

## Maintain the execution plan (artifact-driven workflow only)

When you're driving the artifact-driven workflow's slices by hand, you also keep the **execution
plan** — the same living artifact the autonomous `/goal` path writes — so manual and autonomous
builds produce identical records. (Plain, standalone TDD does not need this.)

At the **start of the first slice**, create `docs/plans/<feature>/<TICKET>-execution-plan.md` if it
doesn't already exist, using the ExecPlan format in
[`../to-goal-prompt/EXECUTION-PLAN-FORMAT.md`](../to-goal-prompt/EXECUTION-PLAN-FORMAT.md). Seed it
with the header plus one section per slice taken from the implementation plan's `## Slices` master
checklist, each at `State: todo`. Keep it lean — observable acceptance over internal detail; don't
paste the full template, just follow the format file.

As you work each slice, update that slice's entry at **every stopping point** (it's the recovery
point on restart):

- **State** — move `todo` → `in-progress` → `done` (with date).
- **Built** — what actually shipped this slice (files/modules/endpoints, with paths).
- **Decisions** — choice + one-line rationale + date.
- **Surprises** — the unexpected, with evidence (a test output, a type/CT shape, an API response).
- **Checkpoint / AC coverage** — each acceptance criterion mapped to its named passing test.

When a slice reaches **green and is committed**, also tick that slice's box `- [x]` in the
implementation plan's `## Slices` master checklist — the two artifacts move together.

After the **last slice**, append the **Outcome** retrospective block from the format file.

## After the last slice — hand off the e2e batch

When you're driving the artifact-driven workflow's slices by hand, the `Level: e2e` rows in each
slice's **Test floor** are **owed**, not written here — only unit/integration tests are built during
the slice loop. E2e flows span slices, so they are authored and run as **one batch once every slice
is done**. So when the **last slice is green and committed**, stop, **clear the context**, and run
**`/e2e-pass`** in a fresh session: it authors the owed e2e specs (and can grill the feature docs +
implementation for more), boots the stack, establishes the auth session, and runs the suite once.

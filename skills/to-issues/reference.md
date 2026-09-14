# To Issues — reference

## Issue body template

One published issue per approved slice, in dependency order (blockers first) so "Blocked by" can
reference real identifiers.

```markdown
## Parent

A reference to the parent issue on the issue tracker (if the source was an existing issue, otherwise omit).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer
implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a
snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type
shape), inline it and note it came from a prototype. Trim to the decision-rich parts.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Test floor (must build, red-first)

<the test-floor table — see format below>

## Blocked by

- A reference to the blocking ticket (if any), or "None - can start immediately".
```

## Test floor table format

The per-slice test plan, co-located with the AC. One row per behavior to protect:

| Test (behavior)       | Level (unit/int/e2e) | Pins AC | Must assert                  |
| --------------------- | -------------------- | ------- | ---------------------------- |
| <behavior under test> | unit \| int \| e2e   | AC1     | <the load-bearing assertion> |

- **`Level` is mandatory on every row** (unit / integration / e2e) — a blank `Level` is an incomplete
  plan. It routes execution downstream: unit/int run red-first during the build; e2e is written but
  batched to a single human-gated run at the end (`/e2e-pass`).

## Master slice checklist

Directly after the `Test plan approved:` marker, write a `## Slices` section: one numbered `- [ ]`
checkbox per slice (title, optionally "Blocked by"), in dependency order, mirroring published-issue
order. The build step ticks each box `- [x]` as it completes the slice — progress self-tracked on disk.

```
## Slices
- [ ] 1. <slice title>
- [ ] 2. <slice title>
```

## Test-plan adjustment policy (lighter-by-default)

The approval marker is a **baseline, never auto-invalidated**. When the plan's tests change later,
don't force a re-grill by default — append a stamped delta line under the marker:

```
Test plan adjustments:
- Adjusted <YYYY-MM-DD>: <what changed> — <why> (minor/moderate)
```

Threshold turns on *what the change is about*:

- **Stamp & proceed (minor/moderate):** the change is about the **tests** — add a discovered test,
  tighten an assertion, swap a `Level` when behavior is unchanged, adjust one slice's floor. The AC
  and plan are still correct. Append the delta line and continue.
- **Recommend redo (large):** the change reveals the **plan or AC itself is wrong** — behavior under
  test shifts, multiple slices' floors materially rewritten, a new testable surface emerges. Grilling
  the tests alone wouldn't fix it because the wrong thing is upstream: recommend re-running
  `/to-issues` (and re-grilling the PRD with `/grill-with-docs` if needed), producing a new baseline
  marker.

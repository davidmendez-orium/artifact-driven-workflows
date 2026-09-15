# Coverage report template

Structure for `<TICKET>-test-coverage-report.md` — **gaps first, recommendations second**, as
separate sections.

```markdown
# Test coverage report — <TICKET>

> PRD: ./<TICKET>-prd.md · Plan: ./<TICKET>-plan.md · ExecPlan: ./<TICKET>-execution-plan.md
> Baseline captured: <YYYY-MM-DD> · commit <SHA> · worktree <path>

## Summary

<2-4 sentences: overall quality of the testing, are the AC honestly covered, headline gaps.>

## Coverage baseline (measured)

| Workspace | Tests | Statements | Branches | Funcs | Lines | Notes |
| --------- | ----- | ---------- | -------- | ----- | ----- | ----- |

<per affected workspace; numbers scoped to changed files>

E2E: <applicable? which site/e2e specs are relevant; is .auth/user.json present>

## Per-slice coverage

<for each slice: the analyst's verdict + AC→evidence table (with quoted assertion + mutation)>

## Floor audit

<per slice: was every planned Test floor test built and useful? list any built-but-hollow floor tests
(→ a gap) and any Discovered tests the run added beyond the floor.>

## Holistic requirement coverage

<the holistic analyst's verdict: cross-slice / end-to-end flows, requirements that span slices>

## Gaps

<single severity-ranked table of all confirmed gaps, each tied to a PRD requirement or slice AC.
This is the "what is not protected" section — no recommendations here.>
| # | Gap | Tied to (req/AC/slice) | Severity | Why it matters |

## Recommendations

<the tests to build, ordered by severity, each closing a numbered gap above. THIS is the action list.>
| # | Closes gap | Level (unit/integration/e2e) | Target file | What it asserts | Regression proof (sev≥7) |

## Test-quality issues (existing tests)

<brittle / overfit / hollow tests worth fixing — optional>
```

---
category: testing
name: systematic-debugging
description: Root-cause-first debugging gate. Use when a test or behavior is failing and you're tempted to patch the symptom — forces you to find why it fails before changing code. Especially when a /goal run is blocked twice on the same failure.
---

# Systematic Debugging

## The Iron Law

> **NO FIX WITHOUT A ROOT CAUSE FIRST.**
>
> Do not change code to make a failure go away until you can state, in one sentence, _why_ it was
> failing. A change that makes the symptom disappear without a named cause is a guess — it hides the
> bug, moves it, or breaks something else silently.
>
> _Adapted from Superpowers `systematic-debugging` (obra/superpowers, MIT — Jesse Vincent)._

## The loop

1. **Reproduce.** Get the failure to happen on demand — the failing test, the exact command, the
   minimal input. If you can't reproduce it, you can't claim to have fixed it.
2. **Read the actual error.** The real message, stack, and the line it points at — not what you assume
   it says. Paste it; don't paraphrase from memory.
3. **Form one hypothesis** for the root cause and state it. "X fails because Y is null when Z runs."
4. **Confirm the cause before the fix** — add a log/assert, inspect state, or write a test that pins
   the cause. Watch it confirm the hypothesis. If it doesn't, the hypothesis was wrong → back to 3.
5. **Fix the cause, not the symptom.** Then re-run the reproduction from step 1 → it passes. For a
   real regression, the red→green proof applies: the fix, reverted, should bring the failure back.

## Anti-symptom-fix gate (reject these)

| Tempting patch                       | Why it's a symptom fix                                           |
| ------------------------------------ | ---------------------------------------------------------------- |
| Wrap it in try/catch and move on     | Hides the failure; the bad state still propagates.               |
| Add a null check at the crash site   | Treats the place it _surfaced_, not where the null came from.    |
| Bump a timeout / add a retry         | Masks a race or a real slowdown you haven't explained.           |
| Loosen the assertion until it passes | Now the test protects nothing — see the `/tdd` hollow-test trap. |
| Re-run until it's green              | Flaky-passing is still failing; find why it's nondeterministic.  |

## Headless `/goal` integration

When a `/goal` run is **blocked twice on the same failure**, that is the trigger for this gate: stop
patching, run the loop above, and record the root cause in the ExecPlan (Surprise: symptom →
confirmed cause → fix, with evidence). If the cause can't be confirmed, log it as a genuine blocker
for the human rather than shipping a guessed fix.

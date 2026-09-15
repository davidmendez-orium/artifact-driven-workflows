---
category: project-planning
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
---

<what-to-do>

Work from the ticket's raw source material in `docs/plans/<ticket>/raw/` (what `/fetch-from-jira`
wrote) plus the codebase.

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk
down each branch of the design tree, resolving dependencies between decisions one-by-one. Ask the
questions one at a time, waiting for feedback on each before continuing, and for each question provide
your **recommended answer**. If a question can be answered by exploring the codebase, explore instead
of asking.

As terms and decisions crystallise, **maintain the domain model inline** — challenge terms against the
glossary, sharpen fuzzy language, stress-test with concrete scenarios, and cross-reference claims
against the code. Follow the **domain-modeling** skill for how and when to write glossary entries
(`CONTEXT.md`) and ADRs — it owns those formats and the create-lazily rules. Capture each as it
happens; don't batch.

**Done when** every term in the plan is resolved against `CONTEXT.md`, every plan/code contradiction
is surfaced or logged, and each open question is either answered or recorded as a genuine blocker.
Then hand off to `/to-prd` — run it in this same session so it inherits the grilling context.

</what-to-do>

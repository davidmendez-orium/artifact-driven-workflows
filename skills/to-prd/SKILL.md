---
category: documentation
name: to-prd
description: Turn the current conversation into a PRD file on disk — no interview, just synthesis of what you've already discussed.
disable-model-invocation: true
---
This skill takes the current conversation context (normally the preceding `/grill-with-docs` session) and codebase understanding and produces the PRD — the **what & why**, not the how. Do NOT interview the user — just synthesize what you already know.

Output: write `docs/plans/<ticket>/<ticket>-prd.md`. The ticket's Jira/Confluence data is already saved under `docs/plans/<ticket-id>/`; if you don't know the ticket number, ask.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the PRD, and respect any ADRs in the area you're touching.

2. Sketch out the seams at which you're going to test the feature, preferring existing seams to new ones and the highest seam possible — fewer seams is better, ideally one. Check with the user that these seams match their expectations.

3. Write the PRD to `docs/plans/<ticket>/<ticket>-prd.md` using the template below, then hand off to `/to-issues`.

<prd-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A long, numbered list of user stories — extensive enough to cover all aspects of the feature. Each in the format:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.

</prd-template>
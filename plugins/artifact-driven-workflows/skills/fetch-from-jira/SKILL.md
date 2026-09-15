---
category: documentation
name: fetch-from-jira
description: Fetch a single Jira ticket and its linked docs into docs/plans/<ticket>/raw/ as raw source material for a downstream grill / PRD session. Pulls the ticket, follows its references exactly one hop (Confluence, linked Jira, Drive/Docs, Figma, GitHub), preserves everything verbatim via parallel sub-agents, and flags any artifact it could not retrieve on a manual-provide list. Offers to also pull sibling tickets from the same epic for a fuller picture, the user's call. Use when the user wants to fetch / pull in / grab a Jira ticket and its linked context. For a whole epic by default, use gather-raw-context instead; this does no interpretation.
argument-hint: '<JIRA-TICKET-KEY, e.g. ABC-1234>'
allowed-tools: Bash, Read, Write, Task, WebFetch, mcp__atlassian__jira_get_issue, mcp__atlassian__jira_search, mcp__atlassian__confluence_get_page, mcp__atlassian__confluence_search, mcp__github__github_get_file_contents, mcp__github__github_search_code
---

# Fetch From Jira

You collect **raw** source material for one Jira ticket — its body and the docs it points
at — so a later session (grill-with-docs, /to-prd) can work from disk instead of
re-querying the tracker. You **gather, you do not interpret**: every artifact lands
**verbatim**, never summarized.

Defaults (state them): depth = **one hop**, link types = all (Confluence, linked Jira,
Drive/Docs, Figma, GitHub). Output dir = `docs/plans/<TICKET-KEY>-<slug>/raw/`.

## 1. Scope

The target ticket is always in scope. Fetch it, and read its parent epic from the result.
Then **ask the user** whether to also pull sibling tickets from that epic for a fuller
picture — their call — and if yes, let them choose which (e.g. all, only Ready for
Analysis, or specific keys). Any chosen siblings join the scope.

**Done when:** the in-scope set (target ± chosen siblings) is enumerated and the user
hasn't contradicted it.

## 2. Fan out — one sub-agent per in-scope ticket

Spawn the sub-agents **in a single message** so they run in parallel. Each agent:

- fetches its ticket with `fields: "*all"`, `expand: "renderedFields"`;
- writes `raw/ticket-<KEY>-<slug>.md` — metadata block + description + acceptance
  criteria + comments + issue-links, **verbatim** (preserve headings, tables, code; do
  not summarize);
- **returns the outbound references it found** (Confluence pageIds, Jira keys,
  Drive/Figma/GitHub URLs) **without fetching them**, plus anything it couldn't read.

**Done when:** every in-scope ticket has a raw file and has reported its references.

## 3. One hop

Dedupe all reported references into one unique set, then fetch each **exactly once**
(parallel sub-agents), writing one raw file per reference (`confluence-<id>.md`,
`linked-<KEY>-<slug>.md`). Large MCP responses get spilled to a file — hand the sub-agent
the path and tell it to read the whole file before converting.

**One hop only:** do not fetch references discovered _inside_ these — record them as
deeper links, leave them unfetched.

**Done when:** every unique reference is either written to a raw file or flagged in step 4.

## 4. Index + gaps

Write two files:

- `_INDEX.md` — one row per raw file (target, any siblings, fetched references), so the
  next session has a map. Lead with it.
- `_GAPS-manual-provide.md` — **fetch-or-flag**: every reference you could not retrieve
  yourself goes here with its exact URL/name and what the user must hand you —
  auth-walled artifacts (Figma, Drive), names with no link, binary diagrams. Also list the
  deeper (>one-hop) links as optional follow-ups, and any source caveats the sub-agents
  flagged (garbled rendering, reversed link directions, authoring errors).

**Done when:** nothing you failed to fetch is silently dropped — each missing artifact is
on the gaps list. Close by telling the user the gaps list exists and offering to pull the
deeper links.

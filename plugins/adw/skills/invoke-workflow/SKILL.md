---
name: invoke-workflow
description: 'Invoke one of the artifact-driven dev workflows shipped with this skill (bugfix HITL, bugfix HITL + worktree, feature HITL) against a Jira ticket. Use when the user runs /invoke-workflow, or asks to "start/run/kick off a workflow", "run the bugfix/feature workflow", or "walk me through this ticket end-to-end". Syntax: /invoke-workflow [workflow] [ticket key | url] [branch=<name>] [any other instructions]. Every workflow starts from a freshly fetched base branch, main unless branch= says otherwise.'
---

# invoke-workflow

The workflows in this skill's `references/` are **prompt templates** — each is a self-contained,
eight-step "AI development workflow guide" with a `<TICKET_URL>` placeholder. Invoking one
means: resolve the template (fill in the ticket), then **adopt its instructions as your own
and begin at step 1**. There is no app to launch; the driver is a resolver.

Syntax: `/invoke-workflow [workflow] [ticket key | url] [branch=<name>] [any other instructions]`

**Every workflow starts from a freshly fetched base branch.** That base is `main`
unless a `branch=<name>` argument says otherwise, and the templates open by getting
onto it — the two worktree variants by cutting a checkout from it, the two
non-worktree variants by refusing a dirty tree and cutting the working branch from
it in place. This is not advisory: a run started on top of whatever the checkout
happened to be holding produces a plan written against code that isn't on the base,
and nobody finds out until review.

The skill is self-contained: `driver.mjs` and the workflow templates in `references/` ship
together, and nothing resolves outside this directory. Run the commands below from this
skill's directory, or with an absolute path to `driver.mjs` — derive it from this SKILL.md's
own location rather than assuming a repo layout.

## Run (agent path)

**1. If the user didn't name a workflow, list them and ask which one:**

```bash
node <skill-dir>/driver.mjs list
```

**2. Resolve the chosen workflow with the ticket.** The workflow matches by slug,
and an exact slug always wins — `bugfix-hitl` and `feature-hitl` resolve to the
main-checkout variants even though the `-worktree` slugs contain them. A shorter
substring only works if it is unique, so `bugfix`, `feature` and `worktree` are
each refused with a list of candidates. The ticket accepts a key `ABC-1234` or a
full URL, whichever the user gave you — pass it through verbatim rather than
reshaping it:

```bash
node <skill-dir>/driver.mjs show feature ABC-1234
node <skill-dir>/driver.mjs show feature https://your-site.atlassian.net/browse/ABC-1234
node <skill-dir>/driver.mjs show feature ABC-1234 branch=release/24.3
node <skill-dir>/driver.mjs show feature ABC-1234 be thorough about the repro
```

Arguments after the workflow name are **order-free and identified by shape**, so
hand the user's words through verbatim instead of trying to reshape them:

| Argument | Taken as |
|---|---|
| `ABC-1234`, or any `http(s)` URL | the ticket |
| starts with `branch=` | the base branch |
| anything else | free-text instructions for this run |

So `feature-hitl-worktree ABE-1233 Be sure to gather all the info properly` is a
valid invocation: the key is the ticket, the rest is instruction. Quoting is not
required. A bare number is still refused — it is almost always a half-typed
ticket, and filing it as prose would start the run with no ticket at all.

**2a. If a `branch=` was given, CONFIRM IT BEFORE STEP 0.** The banner prints the
exact question to ask. Wait for the answer — a base branch is one short argument
that silently redirects every commit, test run and diff in the whole workflow, and
it is invisible once the run is under way. On "n", re-run `show` without the
`branch=` argument rather than trying to correct it mid-flight.

**3. Clear the prerequisite check before you begin step 1.** `show` runs it for you and
prints the result in the banner — it resolves every skill the chosen template calls and
reports which are installed. `node <skill-dir>/driver.mjs check [workflow]` runs the same
check on its own (exit `2` if anything is missing).

If the banner says `PREREQUISITES MISSING`, **stop and prompt the user for a correction
before starting** — name the missing skills and offer the options that actually exist:
install them, switch to a workflow that doesn't need them (the `-worktree` variants need
one more than the others), or knowingly proceed with a gap. Do not improvise a substitute
for a missing skill, and do not start and hit the gap five steps in. If you believe the
check is wrong — the skill is installed somewhere it doesn't search — say so and let the
user confirm rather than silently overriding it.

**4. Adopt the printed instructions** (everything after the
`===== ADOPT THE INSTRUCTIONS BELOW AND BEGIN =====` banner) as your active task, and
begin at step 1. The banner echoes the resolved ticket and source file so you can confirm
you loaded the right one. If the ticket line says `(none supplied)`, ask the user for the
ticket before starting.

**5. Offer the rename as a one-line helper, in the same breath as your step-1 ask.** Never
spend a turn on it. The message where you confirm the resolved ticket and ask for the
go-ahead on step 1 also carries the ready-to-paste line:

```
/rename ABC-1234 feature-hitl
```

`/rename` (alias `/name`) renames the conversation **and** the terminal tab/panel title, so a
row of parallel workflow panels is identifiable at a glance. Use the resolved ticket key plus
the workflow slug — the driver prints the exact line to hand over. Drop it entirely if the
ticket key is already in the title, or if no ticket resolved.

Frame it as a helper, not a request: offer it once, then ask for the step-1 go-ahead and
proceed on their answer. It is cosmetic and never a blocker — do not re-raise it, and do not
wait on it.

These workflows are **human-in-the-loop**: they pause for the user's go-ahead at every step
and forbid running ahead. Honour that — do not autonomously blast through the steps.

## Hand-back owes two written artifacts

Every workflow's final step hands back so the **user** commits and pushes. That is the step
agents silently skip work on: the PR doesn't exist yet, so the outward artifacts feel like
someone else's job. They aren't. Before you hand back, draft both and show them to the user:

1. **The PR body, ending in a `Core Claims` section** — a falsification brief for the
   reviewers (numbered claims hardest-first, each naming the cheapest way to break it;
   known-intentional exceptions; test traps; explicit out-of-scope; any behaviour change the
   ticket didn't ask for), closing with the reviewer contract verbatim.
2. **The ticket's "How to test" comment** — per the QA hand-off policy.

The canonical text for both lives in the hand-back step of the resolved workflow you just
adopted — follow it there rather than from memory, and do not restate or paraphrase the
standard in a new doc.

Three rules that decide whether the Core Claims section earns anything:

- **It goes in the PR body, not a comment.** Bot reviewers fire within minutes of open and
  read only the body.
- **Ship the reviewer contract with the claims.** Claims without a per-claim
  `UPHELD / REFUTED / UNVERIFIABLE` + `file:line` evidence requirement read as an answer key,
  and reviews come back all-green. The workflow's hand-back step cites the PR that produced
  this rule.
- **The contract must be additive, never a scope replacement.** Say plainly that the reviewer
  runs the review their own instructions define, in full, *and* falsifies the claims on top of
  it. Wording that opens with "your job is to falsify these claims" reads as the whole
  assignment, and the diff ends up reviewed more narrowly than it would have been with no Core
  Claims section at all. The same rule applies to you when you are the reviewer.

## PR strategy — asked once, before the build

All four templates settle how a ticket's slices become PRs at the step immediately **before** the
build — 3.5 in the non-worktree variants, 3.6 in the two that spend 3.5 on `/create-worktree` — not
at hand-back. Asking there is what makes the answer cheap: branches can simply be cut per slice as
the build goes, instead of a finished fat branch having to be carved back apart afterwards.

**The question is gated on size and recommends one PR.** Three slices or fewer and it is not asked
at all — the run says it is filing a single PR and moves on. Four or more, it asks once via
`AskUserQuestion`: one PR (recommended), stacked PRs, or separate non-stacked PRs. Stacking is real
overhead for reviewers, and it only pays on a genuinely large feature; defaulting to it on every
multi-slice ticket buys a merge-ordering chore for a diff nobody found too big in the first place.
The answer is recorded in the plan as a one-line `PR strategy:` entry so the build step and the
hand-back step read one decision rather than each re-deriving it, and it is asked **once** — step 8
honours the recorded answer rather than re-opening the question.

**The separate-PR option carries a correctness check.** One branch per slice, all cut from the base,
is only honest when no slice imports another. Where they do, the templates say to tell the user a
stack is the truthful answer instead — a non-stacked child PR referencing a symbol from an unmerged
sibling does not build on its own.

**No carving skill is named, deliberately.** The stacked path is plain `git switch -c` plus
`gh pr create --base <the branch below it>`, written out in the template. Any skill named in a
template becomes a hard prerequisite for every install (see *How the check works* below), and this
is the one path in the workflow that is usually not taken.

## Delegated PR creation — the merge gate at step 8

Step 8 hands back by default: the user commits and opens the PR themselves. When they instead ask
the run to open it, all four templates require one gate first — every branch about to be opened must
still merge into the base it targets, checked with
`git merge-tree --write-tree --name-only origin/<BASE_BRANCH> <branch>` after a fresh fetch.

**The gate exists because `gh pr create` is not one.** It opens a conflicted PR exactly as readily as
a clean one, so without this check the first party to learn the base moved is a reviewer, hours
later, on a PR nobody can merge. `merge-tree` is the right instrument because it merges in memory —
it writes no working tree, index or HEAD — so the check costs nothing and is safe to run mid-run on a
dirty tree, unlike a `git merge --no-commit` / `git merge --abort` probe (offered only as the
fallback for git older than 2.38, and never on a dirty tree).

**Each branch is checked against its own target, and the set is all-or-nothing.** For a stack that
means slice `i` against slice `i-1`, not against the base branch — checking a whole stack against
`<BASE_BRANCH>` tests a merge that will never happen. If any branch in the set conflicts, none are
opened: a stack whose lower slice is conflicted makes every PR above it wrong too.

**On a conflict the run stops and asks; it never resolves.** It reports the branch, the conflicting
paths and the base SHA, then offers rebase / merge-in / leave-it-to-me and waits. Resolving someone
else's conflict unattended is how a silent mismerge ships, and the no-force-push rule protecting
stacked slice branches applies here too.

## Workflows

- `bugfix-hitl` — fix a Jira bug end-to-end, TDD + HITL, in the main checkout.
- `bugfix-hitl-worktree` — same, split across a step 0 (clean analysis checkout) and a step 3.5 (full worktree setup).
- `feature-hitl` — build a feature ticket end-to-end, TDD + HITL, in the main checkout.
- `feature-hitl-worktree` — same, split across a step 0 (clean analysis checkout) and a step 3.5 (full worktree setup).

**All four open with a step 0 that gets onto a fresh base**, but they pay for it
differently. The worktree variants cut a separate checkout from `origin/<base>` and
leave your current tree untouched. The non-worktree variants work *in* your checkout,
so their step 0 refuses to start on a dirty tree, fetches `origin/<base>`, reports the
resolved SHA, and cuts the working branch from it in place. That refusal is the point:
those two used to inherit whatever was lying around, which is how a plan ends up
written against code that was never on the base.

**The worktree variants are the default when tickets run in parallel.** They split worktree
creation in two, because the two halves have different costs and are needed at different times:

- **Step 0 — clean analysis checkout.** A hand-rolled `git worktree add --detach
  .worktrees/<TICKET-ID>-analysis origin/main` after `git fetch origin main`, and nothing else.
  It exists so no part of the run reads or diagnoses on a tree carrying another ticket's
  uncommitted changes or a stale local `main` — a root cause named against dirt gets attributed
  to `main`, and a worktree cut later can't clean the analysis it was based on. Read-only,
  detached, no branch burned, so step 3.5 still names the real working branch.
- **Step 3.5 — full setup via `/create-worktree`.** The expensive, stateful half, whatever the
  project's own copy of that skill entails: isolated ports, per-worktree environment config,
  any bespoke databases, dependency install plus the project's setup task, a permissions copy,
  start/stop scripts, agent orientation notes. Deferred until the plan is approved, so a
  ticket that dies in grilling never pays it, and by then step 1 has fetched the ticket so the
  `<slug>` in `<TICKET-ID>-<slug>` is actually known. It also retires the step-0 checkout.

**Why step 0 is allowed to hand-roll when 3.5 forbids it.** The prohibition exists because a
hand-made worktree lacks the isolated ports and env wiring — a failure mode that only fires once you
*run* something. A detached, read-only checkout never boots a service, so it can't hit it. The
templates state this inline so it doesn't read as a loophole.

**The bugfix variant carries a promotion rule.** Its step 1 has to confirm the repro, and step
0's checkout has no deps or ports — so if the repro needs a booted stack, step 1 promotes
`/create-worktree` to that point and treats 3.5 as done. A code-level repro (stack trace, log,
existing failing test) stays in the thin checkout. Either way the repro is never walked in the
main checkout, which is the case the split exists to rule out. The feature variant needs no such
rule: steps 1–3 are fetch, grill and plan, none of which run the stack.

Both templates tell the agent to STOP rather than substitute a hand-made worktree at 3.5 if
`/create-worktree` is absent.

## Gotchas

- **`bugfix`, `feature` and `worktree` each match two workflows.** The driver refuses and lists
  the candidates. An exact slug always wins, so `bugfix-hitl` and `feature-hitl` resolve to the
  main-checkout variants even though the `-worktree` slugs contain them as substrings — use a
  full slug and ambiguity never arises.
- **`terminalTitleFromRename: false` in settings kills the panel-title half of `/rename`** — the
  conversation still gets the ticket key, the tab keeps its auto-generated topic title. It
  defaults to `true`, so this works unless someone has explicitly turned it off.
- **Don't try to automate the rename — this was investigated and rejected (2026-08-07).** The
  agent cannot invoke `/rename`: it's a built-in CLI command, not a skill or tool. Two bash
  routes exist and neither is worth it. (a) The tab title *can* be set by walking up `$PPID` to
  the `claude` process that owns a tty and writing an OSC-0 escape to `/dev/ttysNNN` — proven to
  work, but it only ever does the terminal half. (b) The conversation name lives in
  `custom-title` / `agent-name` records in the session JSONL; appending them does not update the
  live TUI, and writing Claude Code's private transcript format is an undocumented hack that
  breaks silently on any format change. Offer the line and move on.
- **A bare number is rejected, deliberately.** `1234` names neither a project nor a Jira site,
  and the driver will not invent either — an earlier version did, which is exactly what tied
  this skill to one team. Pass a key (`ABC-1234`) or a full URL.
- **`<slug>` in the resolved text is left as-is on purpose** — it's the plan-folder slug the
  workflow tells you to derive from the ticket title, not a ticket placeholder. `<BASE_BRANCH>`
  is the opposite: it is always substituted, so if you still see it in the resolved text,
  something is wrong with the driver, not with your arguments.
- **`branch=` is confirmed, not assumed.** The banner prints a CONFIRM block and the templates
  ask again in their closing line. Two prompts for one argument is deliberate — it is the one
  input that changes every later step and leaves no trace once the run is going.
- **`/create-worktree` has to be told the base too.** Step 3.5 of the worktree variants passes
  it through, and `/create-worktree` reads it into `$BASE_BRANCH` (default `main`). If a
  project's copy hardcodes `main` with no way to override, the templates say to STOP rather
  than accept a worktree cut from the wrong base.

## Ticket and base-branch resolution

**There is nothing to configure, and that is the point.** No Jira site, project key, org or repo
name is stored anywhere in this skill. Every run derives its coordinates from the arguments you pass:

| You pass | Driver resolves | Template gets |
|----------|-----------------|---------------|
| `https://your-site.atlassian.net/browse/ABC-1234` | key from the URL, site from the URL | the full URL |
| `ABC-1234` | the key; **no site is invented** | the bare key — `/fetch-from-jira` resolves the site |
| `1234` | nothing — hard failure with a message naming both accepted forms | — |
| `branch=release/24.3` | that base branch, and a CONFIRM instruction in the banner | `<BASE_BRANCH>` → `release/24.3` |
| *(no `branch=`)* | `main` | `<BASE_BRANCH>` → `main` |
| `be thorough about the repro` | free-text instructions, echoed in the banner | an `EXTRA INSTRUCTIONS FROM ME:` line |
| *(no free text)* | nothing | the `EXTRA INSTRUCTIONS` line is removed entirely |

A key alone is a complete input — `/fetch-from-jira` documents its argument as a ticket key, not
a URL — and guessing a base URL here would only produce a confidently wrong link. Nothing else in
the package resolves outside its own directory.

The base branch is substituted into the template whether or not you asked for one, so the
resolved text never contains a bare `main` that an agent has to interpret. `branch=` is validated
before anything is emitted: letters, digits, `.` `_` `/` `-`, no spaces, no `..`, and it may not
start or end with `/` `.` or `-`. Giving `branch=` twice is a hard failure rather than a silent
drop. A second ticket-shaped argument is not: only the first is taken as the ticket and the rest
becomes free text, which is the price of letting prose sit anywhere on the line.

Free text is appended to the template with a guard the driver adds, not the templates: the
instructions *refine* the steps and never cancel a STOP, a confirmation, or a human-in-the-loop
pause, and an instruction that appears to must be raised rather than obeyed. Guard and text are
one string, so neither can be left behind without the other — and when no free text is given the
whole carrier line is stripped, because an agent reading `EXTRA INSTRUCTIONS FROM ME:` followed
by nothing will invent a reason for it.

## Prerequisites

**Caveat: this skill is a conductor, not the whole band.** Nearly every step of every template
delegates to another skill. Install this one alone and the resolved instructions read perfectly
and then have nothing to run — the failure is invisible until the agent reaches the step. That
is why `show` refuses to be quiet about it and prints a prerequisite report in its banner.

Required by all four templates:

| Skill | Used at |
|-------|---------|
| `/fetch-from-jira` | step 1 — pull the ticket and its linked context |
| `/grill-with-docs` | step 2 — stress-test the plan |
| `/to-prd` | step 2 — publish the durable PRD |
| `/to-issues` | step 3 — vertical-slice plan with a test floor |
| `/tdd` | step 4 — the red/green build loop |
| `/e2e-pass` | step 5 — author + run the e2e batch |
| `/to-coverage-report` | step 6 — coverage and usefulness audit |
| `/documentation-gardening` | step 7 — consolidate before the PR |
| `/systematic-debugging` | bugfix variants only, when a diagnosis stalls |

The two `-worktree` variants additionally need `/create-worktree`, which this skill **does not
ship and deliberately does not define**. Worktree setup is the one genuinely project-specific
step in these workflows — which repos a feature spans, how ports and databases are kept from
colliding, what has to run before the stack will boot — so the templates name the skill by its
role and leave the project to supply it. The driver resolves it like any other prerequisite,
against this skill's siblings, `<cwd>/.claude/skills/` and `~/.claude/skills/`, so whichever
installation the session can see is the one that runs.

A project's copy is expected to cover: branching from a just-fetched `origin/main`, per-worktree
environment config isolating ports/databases/fixtures, dependency install plus any setup task,
carrying over this session's approved permissions, and whatever start/stop scripts and
orientation notes its agents rely on. If a project has no such skill, use a non-worktree variant
— the templates are written to STOP and ask rather than hand-roll a substitute, because a
hand-made worktree works right up until it doesn't.

`/goal` and `/to-goal-prompt` appear in the templates but are **not** prerequisites; they are
named only as the autonomous path these HITL workflows deliberately don't take.

**How the check works.** The driver reads the required set *out of the chosen template* rather
than from a hardcoded list, so it can't drift when a template changes, and resolves each name
against three roots: this skill's siblings, `<cwd>/.claude/skills/`, and `~/.claude/skills/`.
A skill installed somewhere else — a plugin directory it doesn't search — will report as
missing; that's a false negative to raise with the user, not to silently ignore.

Repo-shape assumptions the templates make, all conventions rather than hard requirements:
plan artifacts under `docs/plans/<TICKET-ID>-<slug>/`, feature specs under `docs/specs/`, git
worktrees for the worktree variants, and a JS/TS-ish test runner in the examples. Any repo that
doesn't match can follow the same steps with its own paths.

## Troubleshooting

- `No workflow matches "…"` → run `list` to see the exact slugs.
- `"…" is ambiguous` → the driver prints the candidates; re-run with a more specific substring.
- `PREREQUISITES MISSING` in the banner → see Prerequisites. Stop and ask the user; `check`
  prints the same report on its own and exits `2`, and lists the roots it searched.

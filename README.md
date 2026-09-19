# Artifact-Driven Development Workflows
#### Heavily Inspired by Danny Lake's ADD workflow.

Claude Code skills for running a ticket end-to-end through an eight-step,
artifact-driven workflow: gather context → grill → plan → TDD → e2e → coverage
audit → docs → hand back.

Every workflow is **human-in-the-loop**. They pause for your go-ahead at each
step and are written to stop rather than improvise when something is missing.

## What's here

`invoke-workflow` is the entry point. It resolves one of four workflow templates
into a ready-to-adopt prompt with the ticket, base branch and your own extra
instructions filled in, and it checks that the skills each step delegates to are
actually installed before you start.

| Skill | Role |
|---|---|
| **`invoke-workflow`** | picks a workflow, fills it in, verifies prerequisites |
| `fetch-from-jira` | step 1 — pull the ticket and follow its links one hop |
| `grill-with-docs` | step 2 — stress-test the plan against the domain model |
| `to-prd` | step 2 — publish a durable PRD describing the WHAT |
| `to-issues` | step 3 — vertical-slice plan with a per-behaviour test floor |
| `tdd` | step 4 — the red/green build loop |
| `e2e-pass` | step 5 — author and run the e2e batch |
| `to-coverage-report` | step 6 — coverage *and usefulness* audit |
| `documentation-gardening` | step 7 — consolidate the docs a ticket sprawled |
| `systematic-debugging` | root-cause gate, for the bugfix workflows |
| `create-worktree` | optional — isolated worktrees with port isolation |

## Install

**From the plugin marketplace** — the native route, no clone:

```
/plugin marketplace add davidmendez-orium/artifact-driven-workflows
/plugin install adw@artifact-driven-workflows
```

**Or with the script**, from a clone, if you would rather drop the skills
straight into a skills directory:

```sh
./install.sh              # ~/.claude/skills/    - available in every repo
./install.sh --project    # ./.claude/skills/    - this repo only
./install.sh --check      # report what is installed where
./install.sh --uninstall  # remove them from the same target
./install.sh invoke-workflow tdd     # install only the named skills
```

Each skill is a self-contained directory that resolves nothing outside itself,
so copying it is a complete install; `install.sh` just does it consistently and
runs the prerequisite check afterwards.

Node is required either way - `invoke-workflow`'s resolver is an ES module.

## Use

```
/adw:invoke-workflow [workflow] [ticket key | url] [branch=<name>] [any other instructions]
```

Installed as a plugin the skills are namespaced `adw:`; dropped straight into a
skills directory by `install.sh` they are bare (`/invoke-workflow`).

Arguments after the workflow name are order-free and identified by shape: a
ticket key or URL is the ticket, `branch=…` is the base branch, anything else is
free-text instruction carried into the run.

```
/adw:invoke-workflow feature-hitl ABC-1234
/adw:invoke-workflow bugfix-hitl-worktree ABC-1234 branch=release/24.3
/adw:invoke-workflow feature-hitl-worktree ABC-1234 be thorough about the repro
```

**Every workflow starts from a freshly fetched base branch** — `main` unless
`branch=` says otherwise. The worktree variants cut a checkout from it; the
non-worktree variants refuse a dirty tree and cut the working branch from it in
place. An explicit `branch=` is confirmed with you before step 0.

The four slugs are in the table further down. See
`plugins/adw/skills/invoke-workflow/README.md` for the full argument and
prerequisite reference.

## What each step does

Every workflow is the same eight steps. Feature and bugfix differ in what a step
*means*, not in the shape. Between planning and building sit two half-steps: the
worktree variants spend 3.5 on the worktree and settle PR strategy at 3.6, while
the non-worktree variants have no worktree to build and settle PR strategy at
3.5.

| # | Step | What happens | Skill |
|---|---|---|---|
| **0** | Get onto a clean base | Worktree variants cut a detached, read-only checkout from freshly fetched `origin/<base>`, so nothing is diagnosed on a dirty tree. Non-worktree variants refuse to start on a dirty tree, fetch the base, report its SHA, and cut the working branch in place. | — |
| **1** | Gather context | Pulls the ticket and follows every linked reference exactly one hop — Confluence, linked Jira, Drive/Docs, Figma, GitHub — verbatim into `docs/plans/<TICKET-ID>-<slug>/raw/`, with an index and a list of anything it could not reach. **Bugfix:** also walks the stated repro and reports whether it reproduces as written, needs different steps, or no longer reproduces at all. | `fetch-from-jira` |
| **2** | Grill, then write the PRD | Stress-tests the plan against the domain model, one question at a time, waiting for your answer before the next branch. **Bugfix:** isolates the root cause rather than the symptom, escalating to `systematic-debugging` when you are guessing. Then publishes a durable PRD describing the WHAT — including the agreed test seams. | `grill-with-docs` → `to-prd` |
| **3** | Plan the slices | Turns the PRD into a tracer-bullet, vertical-slice implementation plan — the HOW — each slice carrying its own acceptance criteria, blockers, and a **test floor**: per-behaviour tests, each with a mandatory level. Stops for you to approve. **Bugfix:** one surgical slice, the reproducing test first. | `to-issues` |
| **3.5** | Full worktree setup | Worktree variants only, and deliberately deferred to here: a ticket that dies in grilling never pays the cost. Isolated ports, per-worktree env, dependencies, start/stop scripts. Retires the step-0 checkout. | `create-worktree` |
| **3.5**<br>*(3.6 worktree)* | Settle PR strategy | Asked before the build, so branches can be cut per slice as it goes instead of a fat branch being carved apart afterwards. Gated on size: three slices or fewer files as one PR with no question asked; four or more asks **once** — one PR (recommended), stacked, or separate non-stacked. Recorded in the plan as a one-line `PR strategy:` entry that steps 4 and 8 both read. Separate PRs carry a correctness check: honest only if no slice imports another. | — |
| **4** | Build, red first | Slice by slice, one behaviour at a time: write ONE failing test, run it, show the red, then the minimal code to pass, then the green. Pause at every slice boundary. E2E rows are owed to step 5, not written here. Commit per slice. | `tdd` |
| **5** | The e2e batch | In a fresh session once the last slice is green, because e2e flows span slices and can only be written as whole journeys. Collects every owed e2e row, authors the specs, boots the stack, runs the suite once, records pass/fail back into the plan. | `e2e-pass` |
| **6** | Coverage *and usefulness* | Audits tests against each slice's acceptance criteria and test floor — and checks they are worth having: quote the load-bearing assertion, name a mutation it would catch. A test with no nameable mutation is a gap, not coverage. **Bugfix:** confirms the reproducing test genuinely fails without the fix. | `to-coverage-report` |
| **7** | Garden the docs | Consolidates the markdown the ticket sprawled — one canonical home per fact, supersession explicit, cross-links fixed, durable facts harvested out of the planning husks and into the feature-level spec. Proposes first; changes nothing without per-item approval. | `documentation-gardening` |
| **8** | Hand back | Stops. You commit, verify and push. Before handing over it drafts the PR body ending in a **Core Claims** section and the ticket's "How to test" comment. If you hand PR creation *to it*, it first proves every branch still merges into its base and stops to ask if one doesn't. | — |

### Three things the hand-back insists on

**Core Claims** is a falsification brief, not a summary: numbered claims hardest
first, each naming the cheapest way to break it, plus known-intentional
exceptions, test traps, explicit out-of-scope, and any behaviour change the
ticket didn't ask for. It ships with a reviewer contract requiring a per-claim
`UPHELD / REFUTED / UNVERIFIABLE` plus `file:line` evidence — claims without
that requirement read as an answer key and come back all-green.

**"How to test"** goes on the ticket before QA: PR link, preconditions and
setup, per-AC steps with explicit expected results, regression checks, and the
exact commands stated as all-green.

**A merge check before any delegated `gh pr create`.** Hand-back is the default,
but when you ask the run to open the PR itself it first re-fetches the base and
proves the branch still merges into it, in memory via `git merge-tree`, touching
no working tree. Each branch is checked against the base it actually targets — a
stacked slice against the slice below it, not against the base branch — and if
any branch in a set conflicts, none are opened. On a conflict it reports the
paths and the base SHA and asks you how to resolve; it never resolves for you.
`gh pr create` will open a conflicted PR perfectly happily, so without this the
first person to find out the base moved is a reviewer.

### Which variant

| | In your checkout | Isolated worktree |
|---|---|---|
| **Feature** | `feature-hitl` | `feature-hitl-worktree` |
| **Bug** | `bugfix-hitl` | `bugfix-hitl-worktree` |

The worktree variants are the default when tickets run in parallel. The bugfix
worktree variant carries a promotion rule: if confirming the repro needs a
booted stack, step 1 pulls step 3.5 forward rather than walking the repro on a
thin checkout or a dirty main.

## Before your first run: MCP servers

The skills are only half the dependency. `fetch-from-jira` — step 1 of every
workflow — calls out over MCP, and a server can be **registered and still expose
nothing**: multi-tenant servers connect cleanly, report healthy, and serve zero
tools until a tenant is registered.

`invoke-workflow` detects this and warns in its banner before step 1, flagging
either `NOT REGISTERED` (no server by that name in `.mcp.json` or
`~/.claude.json`) or `REGISTERED BUT NOT CONFIGURED`
(`~/.config/<name>-mcp/tenants/` holds 0 tenants).

The shipped skills need two namespaces — `mcp__atlassian__*` and
`mcp__github__*`. Both are generic, so any server registered under the name
`atlassian` or `github` will do. With a multi-tenant Atlassian server, register
a tenant first:

```sh
atlassian-mcp register <slug>      # site + API token
```

Fix a warning before starting rather than after: the failure otherwise lands
several steps in, once you have already spent a grilling and a planning pass.

## Project-agnostic by design

No Jira site, project key, organisation or repo name is baked in anywhere.
Ticket coordinates come from the argument on each run; `create-worktree` learns
the workspace layout, service list and port scheme from a one-time interview and
saves them to a `.worktree-profile.json` that lives in *your* project, not here.

Repo-shape conventions in the templates — plan artifacts under
`docs/plans/<TICKET-ID>-<slug>/`, feature specs under `docs/specs/` — are
conventions, not requirements. Any repo can follow the same steps with its own
paths.

## Four skills are yours to type

`e2e-pass`, `to-prd`, `to-issues` and `to-coverage-report` carry
`disable-model-invocation: true`, so the agent cannot call them on its own and
they do not appear in its skill list. That is deliberate — they are the steps
that publish an artifact or burn real time, and they stay under your hand. When
a workflow reaches one, you type it:

```
/adw:to-prd        /adw:to-issues        /adw:e2e-pass        /adw:to-coverage-report
```

The other seven (`invoke-workflow`, `fetch-from-jira`, `grill-with-docs`, `tdd`,
`documentation-gardening`, `systematic-debugging`, `create-worktree`) are
model-invocable and show up as `adw:*`.

## Caveats worth reading

- **These are prompt templates, not programs.** They work by being adopted as an
  agent's instructions. Quality depends on the model following them.
- **The workflows delegate heavily.** `invoke-workflow` reports which
  prerequisite skills are missing before you start, because instructions that
  read perfectly and have nothing to run is the failure mode this guards against.
- **`create-worktree` is the least portable piece.** Worktree setup is genuinely
  project-specific; the interview exists to capture that rather than assume it.
  It has not been exercised against a wide range of project shapes.

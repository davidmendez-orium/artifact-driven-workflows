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
/plugin install invoke-workflow@artifact-driven-workflows
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
/invoke-workflow [workflow] [ticket key | url] [branch=<name>] [any other instructions]
```

Arguments after the workflow name are order-free and identified by shape: a
ticket key or URL is the ticket, `branch=…` is the base branch, anything else is
free-text instruction carried into the run.

```
/invoke-workflow feature-hitl ABC-1234
/invoke-workflow bugfix-hitl-worktree ABC-1234 branch=release/24.3
/invoke-workflow feature-hitl-worktree ABC-1234 be thorough about the repro
```

The four workflows:

| Slug | What it is |
|---|---|
| `feature-hitl` | build a feature ticket end-to-end, in your current checkout |
| `feature-hitl-worktree` | same, in an isolated worktree |
| `bugfix-human-in-the-loop` | fix a bug, repro-first, in your current checkout |
| `bugfix-hitl-worktree` | same, in an isolated worktree |

**Every workflow starts from a freshly fetched base branch** — `main` unless
`branch=` says otherwise. The worktree variants cut a checkout from it; the
non-worktree variants refuse a dirty tree and cut the working branch from it in
place.

See `skills/invoke-workflow/README.md` for the full argument and prerequisite
reference.

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

## Caveats worth reading

- **These are prompt templates, not programs.** They work by being adopted as an
  agent's instructions. Quality depends on the model following them.
- **The workflows delegate heavily.** `invoke-workflow` reports which
  prerequisite skills are missing before you start, because instructions that
  read perfectly and have nothing to run is the failure mode this guards against.
- **`create-worktree` is the least portable piece.** Worktree setup is genuinely
  project-specific; the interview exists to capture that rather than assume it.
  It has not been exercised against a wide range of project shapes.

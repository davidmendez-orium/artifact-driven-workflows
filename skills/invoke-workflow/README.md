# invoke-workflow

A Claude Code skill that resolves one of four **artifact-driven development workflows** into a
ready-to-adopt prompt, with the ticket, base branch and your own extra instructions filled in.

There is no app and no daemon. `driver.mjs` is a resolver: it reads a template from
`references/`, substitutes placeholders, prints a banner reporting what it resolved and what is
missing, and the agent adopts the result as its own instructions.

## Install

```sh
./install.sh              # ~/.claude/skills/invoke-workflow   — available in every repo
./install.sh --project    # ./.claude/skills/invoke-workflow   — this repo only
./install.sh --check      # report where it is currently installed
./install.sh --uninstall  # remove it from the same target
```

The skill resolves nothing outside its own directory, so copying the folder *is* a complete
install; `install.sh` just does it consistently and then runs the prerequisite check for you.
Node is required — `driver.mjs` is an ES module.

## Use

```
/invoke-workflow [workflow] [ticket key | url] [branch=<name>] [any other instructions]
```

Everything after the workflow name is order-free and identified by shape:

| Argument | Recognised as | Example |
|---|---|---|
| `ABC-1234` or an `http(s)` URL | the ticket | `ABC-1234` |
| starts with `branch=` | the base branch | `branch=release/24.3` |
| anything else | free-text instructions passed into the template | `be thorough about the repro` |

```sh
node driver.mjs list
node driver.mjs show feature-hitl ABC-1234
node driver.mjs show feature-hitl-worktree ABC-1234 branch=develop gather all the info properly
node driver.mjs check [workflow]     # prerequisites only; exit 2 if any are missing
```

### Base branch

**Every workflow starts from a freshly fetched base branch**, `main` unless `branch=` says
otherwise. The worktree variants cut a checkout from `origin/<base>`; the non-worktree variants
refuse a dirty tree, fetch `origin/<base>`, and cut the working branch from it in place. An
explicit `branch=` triggers a confirmation before step 0 — it is one short argument that silently
redirects every commit and diff in the run.

### Free-text instructions

Trailing prose is carried into the resolved template on an `EXTRA INSTRUCTIONS FROM ME:` line,
together with a guard stating that such instructions refine the steps but never cancel a STOP, a
confirmation, or a human-in-the-loop pause. With no prose given, that line is removed entirely
rather than left showing an empty placeholder.

## Prerequisites — read this before assuming it works

**This skill is a conductor, not the whole band.** Nearly every step of every template delegates
to another skill. Install this one alone and the resolved instructions read perfectly and then
have nothing to run — the failure is invisible until the agent reaches the step. That is why
`show` prints a prerequisite report in its banner and `install.sh` runs the same check on the way
out.

| Skill | Used at | Required by |
|---|---|---|
| `fetch-from-jira` | step 1 — pull the ticket and its linked context | all four |
| `grill-with-docs` | step 2 — stress-test the plan | all four |
| `to-prd` | step 2 — publish the durable PRD | all four |
| `to-issues` | step 3 — vertical-slice plan with a test floor | all four |
| `tdd` | step 4 — the red/green build loop | all four |
| `e2e-pass` | step 5 — author + run the e2e batch | all four |
| `to-coverage-report` | step 6 — coverage and usefulness audit | all four |
| `documentation-gardening` | step 7 — consolidate before the PR | all four |
| `systematic-debugging` | when a diagnosis stalls | bugfix variants |
| `create-worktree` | step 3.5 — full worktree setup | `-worktree` variants |

The driver reads the required set *out of the chosen template* rather than from a hardcoded list,
so it cannot drift when a template changes. It resolves each name against three roots: this
skill's siblings, `<cwd>/.claude/skills/`, and `~/.claude/skills/`. A skill installed somewhere
else — a plugin directory it does not search — reports as missing; that is a false negative to
raise, not to ignore.

`create-worktree` is the one prerequisite that is genuinely project-specific: which repos a
feature spans, how ports and databases avoid collisions, what must run before the stack boots.
This skill names it by role and leaves each project to supply its own. Without one, use a
non-worktree variant — the templates are written to STOP and ask rather than hand-roll a
substitute.

`goal` and `to-goal-prompt` appear in the templates but are **not** prerequisites; they are named
only as the autonomous path these human-in-the-loop workflows deliberately do not take.

## The four workflows

| Slug | What it is |
|---|---|
| `feature-hitl` | build a feature ticket end-to-end, TDD + HITL, in your current checkout |
| `feature-hitl-worktree` | same, in an isolated worktree (step 0 analysis checkout + step 3.5 full setup) |
| `bugfix-human-in-the-loop` | fix a bug end-to-end, repro-first, in your current checkout |
| `bugfix-hitl-worktree` | same, in an isolated worktree |

`bugfix`, `feature` and `worktree` each match more than one slug; the driver refuses and lists the
candidates. An exact slug always wins.

## Portability

No Jira site, project key, org or repo name is stored anywhere in this skill — ticket coordinates
are derived from the argument on each run. Repo-shape assumptions in the templates are
conventions, not requirements: plan artifacts under `docs/plans/<TICKET-ID>-<slug>/`, feature
specs under `docs/specs/`, git worktrees for the worktree variants. Any repo that does not match
can follow the same steps with its own paths.

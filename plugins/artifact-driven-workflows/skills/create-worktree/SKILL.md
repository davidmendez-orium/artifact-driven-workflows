---
name: create-worktree
description: >
  Creates isolated git worktree(s) across one or more repos in a workspace, with
  per-worktree port isolation, environment config, optional bespoke databases,
  generated start/stop scripts, a copied-over Claude permissions file, and a
  WORKTREE.md that gives agents cross-repo context. Project-agnostic: it learns
  the workspace layout, service list and port scheme from an interview the first
  time, then reuses the saved profile. Also handles teardown.
  Use when the user wants to "create a worktree", "set up a worktree", "work in
  isolation", "new worktree", "tear down worktree", or "remove worktree".
---

# Create Worktree

Creates a **matched** git worktree across whichever repos in the workspace the
user selects, so a single change can span several repos on matching branches.

This skill hardcodes **no repo names, no service names and no ports.** It learns
them once, from an interview, and writes the answers to a profile that every
later run reuses. That profile is the only project-specific artifact; the skill
itself is portable.

Each selected repo's worktree gets:

- A working branch cut from a freshly fetched base (default `main`)
- Its own copy of the repo's local Claude permissions file, so the worktree
  inherits the tool allowlist already approved in that repo's main checkout
  instead of re-prompting from scratch
- A `WORKTREE.md` cross-linking the other selected repos

The **primary** repo (the one that runs services) additionally gets:

- Its own env file carrying a **port slot**, so parallel worktrees don't fight
  over the same ports
- Optionally bespoke databases
- Generated `dev-start.sh` / `dev-stop.sh` to start and cleanly stop services on
  this worktree's ports

---

## Step −1: Resolve the Workspace and Load the Profile

Do this first, every time. Never assume the current directory is the repo being
worked on — this skill is routinely invoked from a sibling repo.

```bash
# Works from any repo in the workspace, and from inside an existing worktree
# (--git-common-dir resolves to the MAIN checkout's .git, not the worktree's).
COMMON_GIT_DIR="$(git rev-parse --git-common-dir)"
CURRENT_REPO="$(cd "$(dirname "$COMMON_GIT_DIR")" && pwd)"
WS_ROOT="$(cd "$CURRENT_REPO/.." && pwd)"
PROFILE="$WS_ROOT/.worktree-profile.json"
```

If `$PROFILE` exists, load it and **skip Step 0** — announce which profile you
loaded and the repos it names, then go to Step 1. If it does not exist, run the
interview in Step 0.

Verify every repo path the profile names before using it:

```bash
# for each repo dir in the profile
[ -d "$WS_ROOT/$dir/.git" ] && echo "  ✓ $dir" || echo "  ✗ $dir  NOT FOUND"
```

**Report this resolution to the user before continuing**, and if a repo they go
on to select reported `NOT FOUND`, STOP and say so rather than creating a
worktree in the wrong place. A worktree cut in the wrong repo is quiet: it
succeeds, installs dependencies, and only looks wrong when a build can't find
the app.

**Every `git`, `cp` and `mkdir` below is written with an explicit repo path.**
Do not fall back to a bare `git worktree add` or a relative `../other-repo` —
from a sibling repo those target the wrong tree.

---

## Step 0: The Interview (first run in a workspace only)

Ask these one at a time, not as a wall of questions. Each answer has a default;
accept the default on an empty reply. Keep it short — this runs once.

**1. Which repos are in this workspace?**
List the sibling directories of `$WS_ROOT` that contain a `.git`, and ask which
of them this skill should manage. Record each as `{ "key", "dir" }`, where `key`
is a short label used in prompts and `dir` is the directory name under
`$WS_ROOT`.

**2. Which one is primary?**
The primary repo is the one that runs services, and therefore the only one that
gets a port slot, an env file, dependency installation, databases and start
scripts. If no repo runs services, answer "none" and Steps 6–9 are skipped for
every run in this workspace.

**3. Where do worktrees live, and what are branches called?**
Defaults: worktrees at `<repo>/.worktrees/<name>`, branches `feature/<name>`.
Both are recorded so later runs don't re-ask.

**4. Which services does the primary repo run, and on which ports?**
For each service collect:
- `name` — how you refer to it (also the argument to `dev-start.sh`)
- `basePort` — the port it uses in the main checkout
- `cwd` — the directory to run it from, relative to the repo root
- `start` — the exact command, with `{{PORT}}` where the port belongs

The `start` template is what makes this generic. Write down the command that
actually works in the main checkout today, then replace the port with
`{{PORT}}`. Two things worth asking about explicitly, because they are the usual
source of a worktree that boots on the wrong port:

- **Does the service take its port from an env var or a flag?** If a flag, put
  the flag in the template (`… --port {{PORT}}`); if an env var, put the
  assignment in the template (`PORT={{PORT}} …`). A service whose package script
  hardcodes a port needs the flag form, or it will ignore the slot entirely.
- **Does it need a binary resolved from a specific directory?** Monorepos with
  hoisted dependencies can otherwise pick up a transitive copy of a framework
  CLI. If so, record the absolute-from-repo-root path in the template rather
  than relying on `PATH`.

**5. Port slot scheme.**
Defaults: slots `1`–`9`, offset `slot × 100`, recorded in the worktree's env file
as `WORKTREE_SLOT`. The main checkout is slot `0`. Offer these defaults and only
ask for overrides — a slot range and a per-slot offset is the whole scheme, and
`× 100` keeps each slot's services in their own readable hundred.

**6. Env file.**
Which file the primary repo's services read (default `.env`), and whether the
worktree should start as a copy of the main checkout's. If the repo has no env
file, say so and Step 6 records the slot in `WORKTREE.md` only.

**7. Install and setup commands.**
The commands to run in a fresh worktree of the primary repo before it will boot,
in order (e.g. an install command, then a project setup task). Empty is allowed.

**8. Databases.**
Whether worktrees can have bespoke databases. If yes: which env variables hold
the connection strings, and whether appending a suffix to the database name is
enough to isolate them.

**9. Editor workspace file.**
Whether to generate one (e.g. a VS Code `.code-workspace`) listing the selected
worktrees, and where to put it. Default: no.

Then show the assembled profile and ask for confirmation before writing it:

```bash
cat > "$PROFILE" <<'JSON'
{
  "repos": [ { "key": "app", "dir": "<dir>", "primary": true } ],
  "worktreeDir": ".worktrees",
  "branchPrefix": "feature/",
  "baseBranch": "main",
  "ports": {
    "slotMin": 1, "slotMax": 9, "offsetPerSlot": 100,
    "slotEnvVar": "WORKTREE_SLOT",
    "services": [
      { "name": "<service>", "basePort": 3000, "cwd": "<subdir>", "start": "<command with {{PORT}}>" }
    ]
  },
  "envFile": ".env",
  "copyEnvFromMain": true,
  "install": ["<install command>", "<setup command>"],
  "databases": { "enabled": false, "envVars": [], "suffixSeparator": "_" },
  "editorWorkspace": { "generate": false, "dir": "" }
}
JSON
```

Tell the user the profile is project-specific and belongs in version control if
their team shares this workspace layout — and that it may name internal repos
and services, so it belongs in the project's own repo, not in this skill's.

---

## Creating a Worktree

### Step 1: Choose Which Repos to Include

Ask which of the profile's repos this worktree should span. Use
`AskUserQuestion` with **multiSelect** so any combination is possible, listing
one option per repo in the profile with its path. If the user selects none, ask
again — at least one repo is required.

Record the selection. Every step below that applies only to the primary repo is
marked; skip it when the primary repo was not selected.

### Step 2: Choose a Name

First output a brief intro listing only the repos selected, with their absolute
paths from Step −1:

```
This will create worktree(s) across:
  • <key>  — <absolute path>
A matching branch will be created in each.
```

Then ask for the name as plain text — do **not** use `AskUserQuestion` here (the
name is free-form and that tool requires ≥2 options):

> What would you like to name this worktree? (kebab-case, e.g. `charity-sync`, `fix-checkout`)

If the caller already supplied a name in the invocation args, skip the question
and use it.

The name drives the worktree directory, the branch name, and the database suffix
if bespoke databases are enabled. Good names are short, descriptive, kebab-case.

### Step 3: Branch Setup

**First, settle the base branch.** `$BASE_BRANCH` is what new branches are cut
from. It defaults to the profile's `baseBranch` (itself defaulting to `main`),
but **a caller may specify a different one** — workflow skills pass through
whatever base their run was started with, and a change stacked on another
branch is the ordinary reason.

```bash
BASE_BRANCH="<profile baseBranch, or the base the caller specified>"
```

If the caller named a base other than the default, echo it back before creating
anything: `"Cutting new branches from origin/$BASE_BRANCH (not <default>) — confirm? (Y/n)"`.
A wrong base is silent: everything builds, tests pass, and the PR diff is
against the wrong history.

Then ask:

> Would you like to create a new branch, or check out an existing one?
>
> 1. **New branch** — create `<branchPrefix><name>` from `origin/$BASE_BRANCH` in each selected repo
> 2. **Existing branch** — tell me the branch name (ask separately for each repo
>    if the branch differs between them)

**For each selected repo**, with `$REPO` its absolute path from Step −1:

- **New branch** — fetch first, then create the worktree from the remote ref:

  ```bash
  git -C "$REPO" fetch origin "$BASE_BRANCH"
  git -C "$REPO" worktree add "$WT_DIR/<name>" -b "<branchPrefix><name>" "origin/$BASE_BRANCH"
  ```

  Always branch from `origin/$BASE_BRANCH`, never the local branch of that name,
  to avoid stale commits. If `origin/$BASE_BRANCH` does not exist in a selected
  repo, STOP and say which repo — do not fall back to the default for that one.

- **Existing branch** — `git -C "$REPO" worktree add "$WT_DIR/<name>" <branch-name>`

### Step 4: Keep the Worktree Directory Ignored

For each selected repo, make sure the worktree directory and `WORKTREE.md` are
ignored — idempotently, and in both places:

```bash
for rule in "$WT_DIR_NAME/" "WORKTREE.md"; do
  grep -qxF "$rule" "$REPO/.gitignore" 2>/dev/null || echo "$rule" >> "$REPO/.gitignore"
  grep -qxF "$rule" "$REPO/.git/info/exclude" 2>/dev/null || echo "$rule" >> "$REPO/.git/info/exclude"
done
```

The tracked `.gitignore` is the durable rule inherited by every future worktree;
the per-worktree `.git/info/exclude` guarantees the file is ignored the instant
the worktree exists, before the tracked rule has propagated to that branch.
`WORKTREE.md` needs its own rule because it sits at the worktree's **root**,
where the worktree-directory rule doesn't reach it.

### Step 5: Copy Local Config Into Each Worktree

A repo's local Claude settings file is normally gitignored — personal and
machine-specific — so `git worktree add` never brings it along. Copy it
explicitly, per selected repo, so this session keeps the permissions it has
already had approved:

```bash
[ -f "$REPO/.claude/settings.local.json" ] && {
  mkdir -p "$REPO/$WT_DIR_NAME/<name>/.claude"
  cp "$REPO/.claude/settings.local.json" "$REPO/$WT_DIR_NAME/<name>/.claude/"
}
```

### Step 6: Assign a Port Slot

> **Primary repo only.** Skip entirely if the primary repo wasn't selected, or if
> the profile lists no services.

Each active worktree gets a slot between the profile's `slotMin` and `slotMax`.
The main checkout is slot 0; slot N shifts every service by `N × offsetPerSlot`.

Detect the next free slot from the metadata comment Step 10 writes:

> ⚠️ **Never run recursive operations (`grep -r`, `find` without `-maxdepth 1`,
> `ls -R`) inside the worktree directory.** Each worktree can hold a full
> dependency tree of hundreds of thousands of files, and a recursive command will
> appear to hang. The glob below is safe: it matches `WORKTREE.md` at each
> worktree's root without descending.

```bash
NEXT_SLOT=$SLOT_MIN
for md_file in "$PRIMARY_REPO/$WT_DIR_NAME"/*/WORKTREE.md; do
  [ -f "$md_file" ] || continue
  slot=$(grep -oE 'worktree-slot: [0-9]+' "$md_file" 2>/dev/null | grep -oE '[0-9]+')
  [ -n "$slot" ] && [ "$slot" -ge "$NEXT_SLOT" ] && NEXT_SLOT=$((slot + 1))
done
if [ "$NEXT_SLOT" -gt "$SLOT_MAX" ]; then
  echo "Error: all slots $SLOT_MIN–$SLOT_MAX are occupied. Tear down a worktree first."
  exit 1
fi
```

Record the slot in the worktree's env file (profile `envFile`), creating it from
the main checkout's copy first when `copyEnvFromMain` is set:

```
# ─── Worktree port isolation (slot <SLOT>) ───────────────────
# Port offset = SLOT × <offsetPerSlot>. Use ./dev-start.sh to start services.
# Do NOT start services directly — their own scripts may carry fixed ports.
WORKTREE_SLOT=<SLOT>
```

Then show the user the resolved port for every service in the profile: its
`basePort`, and `basePort + SLOT × offsetPerSlot`.

### Step 7: Bespoke Databases (optional)

> **Primary repo only**, and only when the profile's `databases.enabled` is true.

Ask:

> Would you like bespoke databases for this worktree? This appends
> `<separator><name>` to the database name in each configured connection string,
> so the worktree uses isolated databases.
>
> If you skip this, the worktree shares the main checkout's databases — fine for
> work that doesn't run migrations, risky otherwise.

If yes, for each env var in `databases.envVars`, append the suffix to the
**database name only** — the last path segment of the connection string, before
any `?query` portion. Never modify the host, port, user or password. Show the
before/after for the first one and confirm before writing the rest.

Sanitise the suffix: replace every character that is not a letter, digit or
underscore with `_`, since database names are more restrictive than branch names.

### Step 8: Install Dependencies

> **Primary repo only.** Skip if the profile's `install` list is empty.

Run each command from the profile's `install` array, in order, from the primary
repo's new worktree. Report the outcome of each. If one fails, STOP and show the
output — a worktree with a half-installed dependency tree fails later in ways
that look like application bugs.

### Step 9: Generate the Start & Stop Scripts

> **Primary repo only.** Skip if the profile lists no services.

Generate `dev-start.sh` and `dev-stop.sh` at the root of the primary repo's
worktree, from the profile's service list. Do not write service knowledge into
these scripts by hand — everything specific comes from the profile.

`dev-start.sh` must:

1. Read the slot from the env file and compute `OFFSET = SLOT × offsetPerSlot`.
2. Accept a service name (or a comma-separated list via a `SERVICE` env var, or
   `all`) and start only those.
3. For each service, substitute `{{PORT}}` in its `start` template with
   `basePort + OFFSET`, run it from the service's `cwd`, and record its PID to a
   file so `dev-stop.sh` can find it.
4. Export any service-to-service URLs the profile records, so services on this
   slot address each other on this slot's ports rather than the defaults copied
   from the main checkout's env file.
5. Print the resolved port for every service it started.

`dev-stop.sh` must stop things in three passes, because any one of them alone
leaves something running:

1. **Graceful** — the PIDs recorded by `dev-start.sh`.
2. **Descendants** — processes whose working directory is inside this worktree,
   which catches renamed workers and children the PID file never saw. Take care
   never to kill the stop script itself or its parent shell.
3. **Final sweep** — free this slot's ports directly, in case something is still
   bound after the first two passes.

Make both executable, and make sure they are ignored (Step 4's rules cover the
worktree directory; add these two filenames if the scripts sit at a worktree
root that the rules don't reach).

### Step 10: Create WORKTREE.md

Write `WORKTREE.md` at the root of **each** selected repo's worktree. This is
what gives an agent landing in one worktree the context of the others.

It must contain, at minimum:

```markdown
# Worktree: <name>

<!-- worktree-slot: <SLOT> -->

## Repos in this workspace
<one line per selected repo: key, absolute worktree path, branch>

## Service ports (slot <SLOT>, offset +<OFFSET>)
<table of service, main-checkout port, this worktree's port>   [primary repo only]

## Databases
<bespoke suffix, or "shared with the main checkout">           [if applicable]

## Starting & stopping services
./dev-start.sh [service|all]
./dev-stop.sh                                                  [primary repo only]

## Other active worktrees
<names and slots of the other worktrees found in Step 6>
```

The `worktree-slot` comment is not decoration — Step 6 reads it to find the next
free slot, and teardown reads it to free ports. Keep it.

### Step 11: Editor Workspace File (optional)

> Only when the profile's `editorWorkspace.generate` is true.

Generate a workspace file listing one folder entry per **selected** worktree,
plus any the profile asks for. Omit entries for repos that weren't selected.

### Step 12: Open Paired Agent Sessions in Herdr (optional)

If [Herdr](https://herdr.dev) is installed and its server is running, offer to
open **each selected worktree as its own Herdr worktree workspace** with an agent
session already running in it — the terminal-side equivalent of the editor
workspace file.

Use `herdr worktree open`, **not** `herdr workspace create`. Both produce a
usable workspace, but only `worktree open` registers it as worktree-backed — it
records the repo, branch and checkout path, and lists under `herdr worktree
list`. The git worktree is already built by the earlier steps, with the ports,
env and dependencies Herdr knows nothing about; this step only adopts the
finished checkout.

**Skip this step silently** if `herdr` is not on PATH or the server isn't
running — not everyone uses Herdr.

Ask first, listing only the selected repos:

> "Open the selected worktree(s) as Herdr worktree workspace(s), each with an agent session?"

```bash
if command -v herdr >/dev/null 2>&1 && herdr status 2>/dev/null | grep -q 'status: running'; then
  # Let Herdr track the agent's idle/working/blocked state (idempotent)
  herdr integration install claude >/dev/null 2>&1 || true

  # `worktree open` returns a worktree_opened result carrying workspace / tab /
  # root_pane / worktree / already_open. Only root_pane is a PaneInfo, so
  # root_pane.pane_id is the sole "pane_id" in the payload and `head -1` cannot
  # pick the wrong one. Use `pane run` (command + Enter in the root shell) NOT
  # `herdr agent start` (which spawns a second, empty pane).
  open_herdr_worktree() {
    # NB: the worktree dir is held in `wt_path`, NOT `path`. In zsh, `$path` is
    # bound to `$PATH` as an array — `local path=...` silently overwrites PATH
    # for the function's scope. Avoid every zsh-special name (path, cdpath,
    # fpath, manpath); this snippet runs in the user's interactive shell.
    local label="$1" wt_path="$2" wt_branch="$3" out pane reopened
    out=$(herdr worktree open --path "$wt_path" --branch "$wt_branch" \
      --label "$label" --no-focus 2>&1)
    pane=$(printf '%s' "$out" | grep -o '"pane_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    reopened=$(printf '%s' "$out" | grep -o '"already_open":true')
    if [ -n "$pane" ]; then
      if [ -n "$reopened" ]; then
        echo "  • Herdr worktree '$label' was already open — left as-is"
      else
        herdr pane run "$pane" "claude"
        echo "  ✓ Herdr worktree '$label' → agent starting in $wt_path"
      fi
    else
      echo "  ✗ Could not open Herdr worktree '$label'"
      printf '%s\n' "$out" | head -3 | sed 's/^/      /'
    fi
  }
  # call once per selected repo, with its worktree path and branch
else
  echo "Herdr server not running — skipping Herdr worktree workspace creation."
fi
```

Notes:

- `--no-focus` keeps the new workspaces from hijacking the current screen.
- Re-running is safe: `worktree open` on a path Herdr already has returns the
  existing workspace with `"already_open":true`, and the snippet leaves it alone
  rather than stacking a second agent into its root pane.
- Teardown closes these too — a worktree workspace is still a workspace, so
  `herdr workspace close` applies unchanged.

### Step 13: Confirmation

Report only the lines that apply, with resolved **absolute** paths — the caller
may not be sitting in any of these repos:

```
✓ Worktree        <abs path>   branch: <branch>     [per selected repo]
✓ Claude settings copied into each created worktree (where present)
✓ Port slot       <SLOT>  (<service>: <port>, …)    [primary only]
✓ Dependencies    <install commands run>            [primary only]
✓ Databases       bespoke (suffix <sep><name>) / shared   [if applicable]
✓ Editor workspace <path>                           [if generated]
✓ Herdr worktrees <list actually opened>            [if opened in Step 12]

Next steps:
  cd <primary worktree path>
  ./dev-start.sh            # starts services on this worktree's ports
  ./dev-stop.sh             # stops everything for this worktree
  herdr worktree list       # find the Herdr worktree workspaces (if opened)
```

---

## Tearing Down a Worktree

**Run Step −1 first** — teardown needs the same resolved paths and profile. A
`git worktree remove` aimed at the wrong repo fails loudly, but a port sweep and
an `rm -f` of a workspace file do not.

### Step 1: Identify the Worktree

Ask which worktree to tear down, listing the names found under each managed
repo's worktree directory, with the slot read from each `WORKTREE.md`.

### Step 2: Check for Bespoke Databases

Read the worktree's `WORKTREE.md` (or its env file) to see whether it used
bespoke databases. If it did, ask whether to drop them. If **no**, skip — the
databases remain and can be cleaned up manually. Never drop a database without
an explicit yes.

### Step 3: Close Herdr Workspaces (if any)

Close any Herdr workspaces tied to this worktree **before** removing it — a live
agent session or shell whose cwd is inside the worktree can block
`git worktree remove`. Skip silently if Herdr isn't running.

```bash
if command -v herdr >/dev/null 2>&1 && herdr status 2>/dev/null | grep -q 'status: running'; then
  for label in <the labels Step 12 used>; do
    wid=$(herdr workspace list 2>/dev/null \
      | grep -o "\"label\":\"$label\"[^}]*\"workspace_id\":\"[^\"]*\"" \
      | grep -o '"workspace_id":"[^"]*"' | tail -1 | cut -d'"' -f4)
    [ -n "$wid" ] && herdr workspace close "$wid" && echo "  ✓ Closed Herdr workspace '$label'"
  done
fi
```

### Step 4: Stop Running Services

Stop anything the worktree has running **before** removing it — leftover dev
servers keep ports bound, and a process whose cwd is inside the worktree can
block `git worktree remove`. Prefer the worktree's own `dev-stop.sh`; fall back
to freeing the slot's ports directly if it is missing.

### Step 5: Remove the Worktrees

Per repo that has one:

```bash
git -C "$REPO" worktree remove "$WT_DIR_NAME/<name>"
```

If git refuses because the tree is dirty, show the user what is uncommitted and
let them decide — never force.

### Step 6: Remove Generated Files

Remove the editor workspace file if one was generated. Leave the profile alone —
it describes the workspace, not this worktree.

### Step 7: Confirmation

Report what was removed, which slot was freed, whether databases were dropped or
kept, and that Herdr workspaces were closed (if any).

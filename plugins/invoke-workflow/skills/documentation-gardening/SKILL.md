---
category: documentation
name: documentation-gardening
description: Resolve conflicting, duplicated, stale, or superseded information across a folder of docs (or a set of cross-linked docs) so each fact has one canonical home, supersession is explicit, cross-links stay intact, and discovery indexes are current. Use when docs have drifted apart — the same fact stated two ways, a newer decision silently overriding an older doc, an overview that references rather than absorbs its sources, or a folder sprawled into many overlapping files. Trigger phrases: "garden the docs", "these docs conflict", "consolidate this docs folder", "clean up stale docs", "reconcile the documentation", "too many overlapping docs", "documentation gardening".
---

<what-to-do>

Garden a folder of docs (or a set of cross-linked docs) until each fact has ONE canonical home,
supersession is explicit, cross-links are intact, and discovery indexes are updated.

The most common job is **harvesting durable facts out of ephemeral planning docs into durable homes.**
Planning artifacts — `*-plan.md`, `*-execution-plan.md`, `*-todos.md`, `*-goal-prompt.md`, audits,
handoffs, Q&A scratch — accumulate real decisions, gotchas, invariants, glossary terms, and
integration details mixed in with throwaway scaffolding. Move each durable fact to its correct
permanent home (a runbook, guide, architecture doc, ADR, `CONTEXT.md` glossary, or — last resort —
`AGENTS.md`), then retire the husk. **Move the fact; drop the husk** — don't keep a planning doc alive
just for one fact worth saving.

**Specs are the exception — never a husk.** A PRD/TDD/spec records _what we set out to build and why_
(requirements, scope, non-goals, AC) — intent that is **not reconstructable from code**. Don't be
fooled by a spec sitting in a plans/tickets folder; it is durable. When several ticket-scoped specs
cover one feature, **consolidate them into a single feature-level spec** at `docs/specs/<feature>.md`;
never harvest-and-delete a spec the way you would a plan.

A consolidated per-ticket PRD is **neither deleted nor left untouched** — mark it in place with an
"absorbed" banner at the very top, pointing up to the feature spec (the spec carries the matching
back-pointer; see step 7.1 — together they are the bidirectional provenance link):

> 📦 **Absorbed into [`docs/specs/<feature>.md`](<relative-path>) on <YYYY-MM-DD>** — this ticket's requirements have been consolidated into the top-level feature PRD. Retained for history.

If the ticket was an **additive request** to an existing feature (not a brand-new one), the banner
notes its additions were merged into the existing feature spec rather than seeding a new one.

Work in two phases: **analyse and propose everything up front**, then **resolve with the human**.
Never take a destructive action (delete, overwrite, rewrite) without explicit approval for that
specific change.

## Phase 1 — Analyse (read-only)

**Scale the analysis to the target.** For a single modest folder (≤~20 files in one directory), read
it inline. For a large or scattered target, fan out: dispatch `Explore` agents in parallel, one per
sub-area, to build the inventory and claim map, then resolve centrally. Don't fan out a small folder.

1. **Inventory the target.** Every file: path, declared type (per the taxonomy below), one-line
   purpose, and last-meaningful-update (`git log -1 --format=%cs -- <file>`, not filesystem mtime).
2. **Build a topic/claim map.** Per doc, note its subjects and concrete claims. Overlaps and
   contradictions surface where the same topic appears in multiple rows.
3. **Detect the distinct problems — treat each differently:**
   - **CONFLICT** — two docs assert contradictory facts. Reconcile against **ground truth** (see
     below), never by picking the newer-looking prose.
   - **SUPERSESSION** — a newer decision overrides an older statement. Mark the old one superseded and
     point to the new. Never silently rewrite history; ADRs especially are immutable (see below).
   - **DUPLICATION / SPRAWL** — the same content in several places. Pick ONE canonical home, replace
     the others with a pointer, or delete if purely redundant.
   - **EPHEMERA (harvest-then-retire)** — a planning doc carries durable facts buried in scaffolding.
     Name each durable fact's correct permanent home, harvest it there, retire the husk.
4. **Classify every doc** as `canonical` / `superseded` / `stale` / `unique-keep` / `safe-to-delete`.
   Every non-`canonical`/`unique-keep` classification carries a reason.

## Phase 2 — Propose, then resolve

5. **Print all findings and recommendations in one readable block** — to the transcript, not disk
   (this skill writes nothing to disk except the doc edits the human approves). Show the inventory
   table, the topic/claim map (highlighting overlaps and conflicts), the classification, and a
   numbered list of **recommendations**, each a self-contained decision unit (one recommendation may
   bundle related edits: "merge A and B into C, delete A, repoint links in D and E").
6. **Offer two paths:** **"Approve all"** (execute every recommendation in order) or **"One at a
   time"** (walk the numbered recommendations one decision per turn, each with your recommended
   answer, grill-with-docs style; group tightly-coupled edits into one question).
7. **Execute approved changes in the safe order — harvest, verify, then delete.** Never delete before
   the destination exists and is confirmed:
   1. **Write the durable side first.** Reconcile conflicts, add supersession notes, consolidate
      duplicates and harvest facts into the canonical home, **fix every cross-link** to moved/deleted
      content, and **update the discovery indexes** (`CONTEXT.md` "## Docs", `CONTEXT-MAP.md`,
      `docs/adr/README.md` as applicable). Carry any source citation into the canonical home.
      - **When consolidating PRD(s) into `docs/specs/<feature>.md`, record provenance on the spec
        side**: ensure a bottom `## Provenance & changelog` section exists and **append one row per
        absorbed PRD** (section-level granularity, terse) — the back-pointer pairing with each PRD's
        "absorbed" banner:
        ```markdown
        ## Provenance & changelog

        | Date | Ticket | Source PRD | Change |
        | ---- | ------ | ---------- | ------ |
        | <YYYY-MM-DD> | <TICKET> | [<TICKET>-prd.md](<relative-path>) | <one line; prefix "Additive:" if it extended an existing feature> |
        ```
   2. **Run the pre-deletion verification pass (gate).** Before deleting _any_ file, re-read it in
      full and confirm **every** durable claim — intent, decisions + rationale/rejected-alternatives,
      constraints, evidence — now has a home in the surviving layer. For a large set, dispatch a
      reader agent per doomed file to do this adversarially: its job is to _find_ a claim with no
      durable home, not to bless the delete. List what it checked and where each claim landed.
   3. **Surface gaps and stop on them.** Any claim with no durable home → do **not** delete that file.
      Report the gap, backfill it into its home, re-verify. A failed gate blocks the delete — it never
      downgrades to "delete anyway."
   4. **Delete only what passed.** Anything that fails or you couldn't fully verify goes to
      `docs/stale/` instead of being deleted.

## Disposition guide — what happens to each doc

Make the intended fate explicit in the plan so the human knows exactly what will change:

| Classification      | Fate of the old doc                                                                 | Reversible? |
| ------------------- | ----------------------------------------------------------------------------------- | ----------- |
| `canonical`         | Kept and updated in place; becomes the single home for its facts                    | n/a         |
| `unique-keep`       | Kept as-is; nothing else covers it                                                  | n/a         |
| `superseded`        | **Marked superseded in place** + pointer to the doc that replaces it (never erased) | n/a         |
| superseded ADR      | `Status` line flipped to `Superseded by …`; body untouched; new ADR written         | n/a         |
| ephemera, harvested | Durable facts moved to their permanent homes, **then the husk is deleted**          | via git     |
| spec (PRD / TDD)    | **Consolidated into one feature-level spec; per-ticket PRD marked with an "absorbed" banner — never deleted** | n/a         |
| `safe-to-delete`    | Deleted — content is purely redundant and already lives in the canonical home       | via git     |
| uncertain           | Moved to `docs/stale/` rather than deleted, when you can't confirm it's dead         | yes         |

Default bias: **delete planning ephemera once harvested** (git preserves history), but **archive
anything you're unsure about to `docs/stale/`**. Deletion always needs explicit per-item approval.

## Safety — non-negotiable

The harvest→verify→delete gate (step 7), the spec exception, and per-decision approval are the core
safety rules. Two more not implied by the steps:

- **Never delete a doc you didn't read.** If a doc's content contradicts how it was described to you,
  surface that and stop — don't proceed on the description.
- **Never auto-classify a spec as deletable.** A PRD/TDD/spec is durable intent — consolidate it into
  `docs/specs/`, never `safe-to-delete`. It is not made redundant by ADRs or an architecture doc:
  those record decisions and current mechanics, not intent, scope, and non-goals.

</what-to-do>

<supporting-info>

## Respect this repo's documentation taxonomy

Before deciding where consolidated content lands, read the **"Documentation structure"** table in the
root `AGENTS.md`. Match each durable fact to the **most specific home that fits its kind**:

- **`docs/guides/<name>.md`** — integration guide: how a third-party system is wired in.
- **`docs/runbooks/<name>.md`** — step-by-step operational procedure.
- **`docs/architecture/<name>.md`** — end-to-end walkthrough of how a subsystem works.
- **`docs/specs/<feature>.md`** — the durable, consolidated spec: what a feature was meant to do — its
  requirements, scope, non-goals, AC. The intent record, distinct from architecture (how it works
  now). Where consolidated PRDs/TDDs land; carries a bottom `## Provenance & changelog` table.
  Cross-link the product-org source (e.g. the Confluence PRD) if one exists.
- **`docs/adr/{PREFIX}-NNN-*.md`** — one architectural decision each.
- **`CONTEXT.md`** (per-package) — domain glossary (`**Term**:` / `_Avoid_:`) + the `## Docs` index.
  Never commands or implementation detail.
- **`CONTEXT-MAP.md`** (root) — router listing contexts and their relationships.
- **`AGENTS.md`** (root + per-package) — **last resort.** Only short, load-bearing
  gotchas/invariants/patterns that don't fit above, as 1–5 line rules. It's loaded into every agent's
  context, so it must stay minimal — if a fact needs a paragraph, it belongs in `docs/`.
- **`docs/stale/`** — legacy docs, stale unless human-confirmed; a safe holding pen.

When you move a doc or change where a fact lives, **update the `CONTEXT.md` → `## Docs` discovery
index** so agents can still find it.

## ADRs are immutable — supersede, never edit

Read `docs/agents/domain.md` before touching any ADR. It overrides generic ADR conventions: this repo
uses scope-prefixed `{PREFIX}-NNN-title.md` naming, pulls the next number from the **Number registry**
in `docs/adr/README.md` (never by scanning for the highest file), and requires the registry + index
rows to change in the same commit as a new ADR. To supersede: change the `Status` line to
`Superseded by [PREFIX-NNN](./PREFIX-NNN-replacement.md)` and write the replacement as a new numbered
ADR. **Never edit the body of a superseded ADR** — it is the historical record of a past decision.

## What counts as ground truth, in order

1. **Code and live data** — the system as it actually behaves.
2. **ADRs** — decisions deliberately recorded, with their rationale.
3. **Newer prose over older prose** — only as a tiebreaker once 1 and 2 can't settle it. Recency of
   writing is the weakest signal, not the strongest.

</supporting-info>

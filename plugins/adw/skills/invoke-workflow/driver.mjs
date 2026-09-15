#!/usr/bin/env node
// invoke-workflow driver — resolves a workflow prompt template from this skill's
// references/ and emits it ready to adopt, with the ticket placeholder filled in.
//
//   node driver.mjs list
//   node driver.mjs check [<workflow>]
//   node driver.mjs show <workflow> [<ticket-key | url>] [branch=<name>]
//
// <workflow> matches a file in references/ by slug substring
// (e.g. "feature", "worktree", "bugfix-human").

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Workflow templates ship inside this skill — no dependency on any directory outside it.
const HERE = dirname(fileURLToPath(import.meta.url));
const WF_DIR = join(HERE, "references");

// No Jira coordinates are configured here. The site and the project key are
// derived from the ticket you pass on each run — this driver never assumes a
// default org, a default project, or that every run belongs to the same one.

// --- Prerequisite skills -----------------------------------------------------
// A workflow is a conductor: nearly every step delegates to another skill. The
// required set is READ OUT OF each template rather than hardcoded, so it cannot
// drift when a template changes.

// Named in the templates but never invoked: /goal and /to-goal-prompt appear only
// as the contrast the HITL variants deliberately do not run.
const NOT_INVOKED = new Set(["goal", "to-goal-prompt"]);

const SKILL_ROOTS = [
  ...new Set([
    join(HERE, ".."), // siblings — whatever skills dir this one was installed into
    join(process.cwd(), ".claude", "skills"), // the repo being worked in
    join(homedir(), ".claude", "skills"), // user-level
  ]),
];

// A leading "/" preceded by a word char, dot, slash, dash or ">" is a path
// (docs/plans, unit/integration, <slug>/raw), not a skill invocation.
const SKILL_TOKEN = /(?<![\w.\/>-])\/([a-z][a-z0-9-]{2,})/g;

function requiredSkills(text) {
  const names = new Set();
  for (const [, name] of text.matchAll(SKILL_TOKEN)) {
    if (!NOT_INVOKED.has(name)) names.add(name);
  }
  return [...names].sort();
}

function checkPrereqs(file) {
  const text = readFileSync(join(WF_DIR, file), "utf8");
  return requiredSkills(text).map((name) => ({
    name,
    ok: SKILL_ROOTS.some((root) => existsSync(join(root, name, "SKILL.md"))),
  }));
}

function listFiles() {
  return readdirSync(WF_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

function slugOf(file) {
  return basename(file, ".md").replace(/-wf$/, "");
}

function summarize(file) {
  const text = readFileSync(join(WF_DIR, file), "utf8");
  const lines = text.split("\n");
  const heading = lines.find((l) => l.startsWith("# "));
  const title = heading ? heading.slice(2).trim() : slugOf(file);
  // Intro paragraph, trimmed — long enough to show what makes each variant distinct.
  const intro = lines.find((l) => l.trim() && !l.startsWith("#")) || "";
  const clean = intro.replace(/`/g, "");
  const summary = clean.length > 200 ? clean.slice(0, 200).trimEnd() + "…" : clean;
  return { slug: slugOf(file), file, title, summary };
}

function resolveWorkflow(query) {
  const files = listFiles();
  const q = query.toLowerCase();
  const matches = files.filter(
    (f) => slugOf(f).includes(q) || basename(f, ".md").includes(q)
  );
  if (matches.length === 0) {
    fail(`No workflow matches "${query}". Available:\n` + files.map((f) => "  - " + slugOf(f)).join("\n"));
  }
  if (matches.length > 1) {
    // Prefer an exact slug match if present.
    const exact = matches.find((f) => slugOf(f) === q);
    if (exact) return exact;
    fail(`"${query}" is ambiguous — matches:\n` + matches.map((f) => "  - " + slugOf(f)).join("\n"));
  }
  return matches[0];
}

// Ticket shape. A key like ABC-123, or any http(s) URL. Nothing else counts as
// a ticket — which is what lets everything else on the line be free text.
const TICKET_KEY = /^([A-Za-z][A-Za-z0-9]*-\d+)$/;

function looksLikeTicket(arg) {
  return /^https?:\/\//i.test(arg) || TICKET_KEY.test(arg);
}

// Turn a ticket key or a full URL into {url, id}. Both halves come out of the
// argument itself: a URL carries its own site, a bare key carries none and is
// passed through unresolved rather than glued onto somebody's guessed Jira.
// Shape was already checked by looksLikeTicket, so this only has to split it.
function normalizeTicket(raw) {
  if (!raw) return null;
  const t = raw.trim();

  if (/^https?:\/\//i.test(t)) {
    const id = (t.match(/([A-Z][A-Z0-9]*-\d+)/i) || [])[1] || "";
    return { url: t, id: id.toUpperCase() };
  }
  // A key names the issue but not the site. /fetch-from-jira resolves it.
  return { url: null, id: t.toUpperCase() };
}

// Base branch the whole run is cut from. Every workflow starts on a freshly
// fetched copy of it; `main` unless the caller says otherwise with `branch=`.
const DEFAULT_BASE_BRANCH = "main";

// Deliberately narrow: git allows more than this, but a base branch arriving
// from a command line is worth keeping boring. No leading/trailing slash or
// dash, no "..", no whitespace — all of which turn into confusing git errors
// several steps after the mistake was made.
const BRANCH_NAME = /^(?!-)(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]+(?<![\/.-])$/;

// Split everything after the workflow name into three things, in one pass:
//
//   branch=<name>   the base branch, wherever it appears
//   <ticket>        the first argument shaped like a ticket key or URL
//   everything else free-text instructions, joined back into one string
//
// Free text is the common case on a real invocation — "ABE-1233 Be sure to
// gather all the info properly" — so it is collected, not refused. The ticket
// is identified by SHAPE rather than by position, which is what lets prose sit
// on either side of it.
function parseArgs(rest) {
  let base = null;
  let ticketArg = null;
  const notes = [];

  for (const arg of rest) {
    if (/^branch=/i.test(arg)) {
      if (base !== null) fail(`branch= given more than once ("${base}", then "${arg}").`);
      base = arg.slice(arg.indexOf("=") + 1).trim();
      if (!base) fail(`"branch=" was given with no branch name after it.`);
      if (!BRANCH_NAME.test(base)) {
        fail(
          `"${base}" is not a usable branch name.\n` +
            `  Allowed: letters, digits, . _ / - — no spaces, no "..", and it may not\n` +
            `  start or end with / . or -.`
        );
      }
      continue;
    }

    if (ticketArg === null && looksLikeTicket(arg)) {
      ticketArg = arg;
      continue;
    }

    // A bare number is the one piece of prose worth refusing: it is almost
    // always a ticket someone half-typed, and silently filing it as an
    // instruction would start the run with no ticket at all.
    if (ticketArg === null && /^\d+$/.test(arg)) {
      fail(
        `Cannot resolve "${arg}" to a ticket.\n` +
          `  Pass a full ticket URL (https://<your-site>.atlassian.net/browse/ABC-123)\n` +
          `  or a ticket key (ABC-123).\n` +
          `  A bare number names neither a project nor a site, and this driver does not\n` +
          `  assume either — that is what tied earlier versions to one team's Jira.`
      );
    }

    notes.push(arg);
  }

  return {
    ticket: normalizeTicket(ticketArg),
    base: base || DEFAULT_BASE_BRANCH,
    baseExplicit: base !== null,
    notes: notes.join(" ").trim(),
  };
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function cmdList() {
  const rows = listFiles().map(summarize);
  console.log("Available workflows (invoke-workflow/references/):\n");
  for (const r of rows) {
    console.log(`  ${r.slug}`);
    console.log(`    ${r.summary}\n`);
  }
  console.log("Usage: node driver.mjs show <workflow> [<ticket-key | url>] [branch=<name>]");
}

// --- MCP servers the workflow's skills need -----------------------------------
// A skill can be installed and still be unusable: its steps call MCP tools, and
// the server behind them may be unregistered, or registered with no credentials
// (the multi-tenant servers connect fine and expose nothing until a tenant is
// registered). Both look identical to "installed" unless you go and look.

const MCP_TOOL = /mcp__([a-z0-9][a-z0-9_-]*)__/gi;

// Where a registered server could be declared, cheapest first.
function mcpConfigDocs() {
  const docs = [];
  for (const p of [
    join(process.cwd(), ".mcp.json"),
    join(homedir(), ".claude.json"),
  ]) {
    try {
      docs.push({ path: p, doc: JSON.parse(readFileSync(p, "utf8")) });
    } catch {
      /* absent or unreadable — not this check's problem to report */
    }
  }
  return docs;
}

function findMcpServer(name) {
  for (const { path, doc } of mcpConfigDocs()) {
    const direct = doc?.mcpServers?.[name];
    if (direct) return { entry: direct, where: path };
    const byProject = doc?.projects?.[process.cwd()]?.mcpServers?.[name];
    if (byProject) return { entry: byProject, where: `${path} (project)` };
  }
  return null;
}

// Multi-tenant stdio servers keep per-tenant credentials in
// ~/.config/<name>-mcp/tenants/*.json. An empty directory is the failure this
// check exists for: connected, zero tools, and nothing says so until step 1.
function tenantState(name) {
  const dir = join(homedir(), ".config", `${name}-mcp`, "tenants");
  if (!existsSync(dir)) return null;
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return null;
  }
  return { dir, count: files.length };
}

function requiredMcpServers(file) {
  const names = new Set();
  for (const { name, ok } of checkPrereqs(file)) {
    if (!ok) continue;
    const root = SKILL_ROOTS.find((r) => existsSync(join(r, name, "SKILL.md")));
    if (!root) continue;
    let text = "";
    try {
      text = readFileSync(join(root, name, "SKILL.md"), "utf8");
    } catch {
      continue;
    }
    for (const [, server] of text.matchAll(MCP_TOOL)) names.add(server.toLowerCase());
  }
  return [...names].sort();
}

function mcpReport(file) {
  const servers = requiredMcpServers(file);
  if (servers.length === 0) return "";

  const problems = [];
  const fine = [];
  for (const name of servers) {
    const found = findMcpServer(name);
    if (!found) {
      problems.push(`  ${name}: NOT REGISTERED — no MCP server by that name in .mcp.json or ~/.claude.json`);
      continue;
    }
    const tenants = tenantState(name);
    if (tenants && tenants.count === 0) {
      problems.push(
        `  ${name}: REGISTERED BUT NOT CONFIGURED — ${tenants.dir} holds 0 tenants.\n` +
          `     It will connect and expose no tools. Register one before step 1.`
      );
      continue;
    }
    fine.push(tenants ? `${name} (${tenants.count} tenant(s))` : name);
  }

  if (problems.length === 0) {
    return `MCP servers: ${fine.join(", ")} — all registered.\n`;
  }
  return (
    `!!! MCP SERVERS MISCONFIGURED — the skills are installed but cannot call out !!!\n` +
    problems.join("\n") +
    `\n` +
    (fine.length ? `  OK: ${fine.join(", ")}\n` : "") +
    `  Tell the user before step 1. A skill whose MCP server is missing or has no\n` +
    `  credentials fails at the moment it is used, several steps in, and reads as a\n` +
    `  skill bug rather than a configuration gap.\n`
  );
}

function prereqReport(file) {
  const rows = checkPrereqs(file);
  const missing = rows.filter((r) => !r.ok);
  if (missing.length === 0) {
    return `Prerequisites: all ${rows.length} required skills present.\n`;
  }
  return (
    `!!! PREREQUISITES MISSING — DO NOT BEGIN THE WORKFLOW !!!\n` +
    `  Not installed: ${missing.map((r) => "/" + r.name).join(", ")}\n` +
    `  Present:       ${rows.filter((r) => r.ok).map((r) => "/" + r.name).join(", ") || "(none)"}\n` +
    `  Searched:      ${SKILL_ROOTS.join("\n                 ")}\n` +
    `  Tell the user exactly which are missing and ask how to proceed — install them,\n` +
    `  switch to a workflow that doesn't need them, or accept the gap knowingly. Do NOT\n` +
    `  improvise a replacement for a missing skill, and do NOT start the workflow first\n` +
    `  and discover the gap at the step that needs it.\n`
  );
}

function cmdCheck(query) {
  const files = query ? [resolveWorkflow(query)] : listFiles();
  let missingAny = false;
  for (const file of files) {
    const rows = checkPrereqs(file);
    console.log(`${slugOf(file)}:`);
    for (const r of rows) {
      console.log(`  ${r.ok ? "ok     " : "MISSING"}  /${r.name}`);
      if (!r.ok) missingAny = true;
    }
    console.log("");
  }
  console.log(`Searched:\n  ${SKILL_ROOTS.join("\n  ")}`);
  if (missingAny) process.exit(2);
}

function cmdShow(query, rest) {
  const file = resolveWorkflow(query);
  let text = readFileSync(join(WF_DIR, file), "utf8");
  const { ticket, base, baseExplicit, notes } = parseArgs(rest);

  // The base branch is never optional in the resolved text — every template
  // opens by cutting from it, so it is substituted whether or not the caller
  // named one.
  text = text.replace(/<BASE[_-]BRANCH>/g, base);

  // Free-text instructions. With none given, the whole carrier line is removed
  // rather than left showing an empty placeholder — an agent reading
  // "EXTRA INSTRUCTIONS:" followed by nothing will invent a reason for it.
  // The guard is appended here rather than written into the templates so that
  // it can never be left behind on its own: notes and guard are one string, and
  // when there are no notes the entire carrier line goes with them.
  const GUARD =
    " — honour these throughout. They REFINE the steps below; they never cancel " +
    "a STOP, a confirmation, or a human-in-the-loop pause. If an instruction " +
    "seems to, say so and ask me rather than choosing one over the other.";

  text = notes
    ? text.replace(/<EXTRA[_-]INSTRUCTIONS>/g, notes + GUARD)
    : text.replace(/^.*<EXTRA[_-]INSTRUCTIONS>.*\r?\n/gm, "");

  if (ticket) {
    // Fill every ticket placeholder variant the workflow files use. With no URL
    // to hand, the key stands in — /fetch-from-jira takes either.
    text = text
      .replace(/<TICKET[_-]URL>/g, ticket.url || ticket.id)
      .replace(/<TICKET[_-]ID>/g, ticket.id);
  }

  const ticketLine = !ticket
    ? `Ticket: (none supplied — ask the user)\n`
    : ticket.url
      ? `Ticket: ${ticket.id}  (${ticket.url})\n`
      : `Ticket: ${ticket.id}  (key only — /fetch-from-jira resolves the site)\n`;

  // An explicit base is the one input worth a confirmation: it is easy to type,
  // invisible once the run is under way, and every later step inherits it.
  const baseLine = baseExplicit
    ? `Base branch: ${base}  (EXPLICIT — NOT the default "${DEFAULT_BASE_BRANCH}")\n` +
      `  !! CONFIRM WITH THE USER BEFORE STEP 0 — do not begin until they answer !!\n` +
      `  Ask: "Target branch ${base} instead of ${DEFAULT_BASE_BRANCH}? (Y/n)"\n` +
      `  On "n", re-run without the branch= argument to get "${DEFAULT_BASE_BRANCH}".\n`
    : `Base branch: ${base}  (default — no branch= argument given)\n`;

  // Echoed so the agent sees the user's own words in the banner, not only
  // buried in the template body.
  const notesLine = notes
    ? `Extra instructions: ${notes}\n` +
      `  These refine the steps below. They NEVER cancel a STOP, a confirmation,\n` +
      `  or the human-in-the-loop pauses — if they seem to, say so and ask.\n`
    : "";

  const banner =
    `===== WORKFLOW: ${slugOf(file)} =====\n` +
    ticketLine +
    baseLine +
    notesLine +
    `Source: invoke-workflow/references/${file}\n` +
    prereqReport(file) +
    mcpReport(file) +
    (ticket
      ? `Panel title: /rename is user-only — before the first step, ask the user to run:\n` +
        `  /rename ${ticket.id} ${slugOf(file)}\n`
      : "") +
    `===== ADOPT THE INSTRUCTIONS BELOW AND BEGIN =====\n`;

  console.log(banner);
  console.log(text);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "list":
    cmdList();
    break;
  case "check":
    cmdCheck(rest[0]);
    break;
  case "show":
    if (!rest[0]) fail("Usage: node driver.mjs show <workflow> [<ticket-key | url>] [branch=<name>]");
    cmdShow(rest[0], rest.slice(1));
    break;
  default:
    fail(
      "Usage:\n" +
        "  node driver.mjs list\n" +
        "  node driver.mjs check [<workflow>]\n" +
        "  node driver.mjs show <workflow> [<ticket-key | url>] [branch=<name>]"
    );
}

#!/usr/bin/env sh
# Install the invoke-workflow skill into a Claude Code skills directory.
#
#   ./install.sh                 → ~/.claude/skills/invoke-workflow   (all repos)
#   ./install.sh --project       → ./.claude/skills/invoke-workflow   (this repo)
#   ./install.sh --project DIR   → DIR/.claude/skills/invoke-workflow
#   ./install.sh --uninstall     → remove it from the same target
#   ./install.sh --check         → report where it is installed, install nothing
#
# Copies four things and nothing else: SKILL.md, driver.mjs, references/, README.md.
# The skill resolves nothing outside its own directory, so a copy is a complete install.

set -eu

SRC="$(cd "$(dirname "$0")" && pwd)"
NAME="invoke-workflow"
MODE="install"
SCOPE="user"
PROJECT_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      SCOPE="project"
      if [ $# -gt 1 ] && [ "${2#--}" = "$2" ]; then PROJECT_DIR="$2"; shift; fi
      ;;
    --uninstall) MODE="uninstall" ;;
    --check)     MODE="check" ;;
    -h|--help)   sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
  shift
done

if [ "$SCOPE" = "project" ]; then
  BASE="${PROJECT_DIR:-$PWD}"
  DEST="$BASE/.claude/skills/$NAME"
else
  DEST="$HOME/.claude/skills/$NAME"
fi

if [ "$MODE" = "check" ]; then
  for d in "$HOME/.claude/skills/$NAME" "$PWD/.claude/skills/$NAME"; do
    [ -f "$d/SKILL.md" ] && echo "installed: $d" || echo "absent:    $d"
  done
  exit 0
fi

if [ "$MODE" = "uninstall" ]; then
  if [ -d "$DEST" ]; then rm -rf "$DEST"; echo "removed $DEST"; else echo "nothing at $DEST"; fi
  exit 0
fi

# The driver is a Node ES module. Without node the skill installs fine and then
# fails at the moment of use, which is the failure this check exists to move earlier.
if ! command -v node >/dev/null 2>&1; then
  echo "WARNING: 'node' is not on PATH. The skill will install, but driver.mjs" >&2
  echo "         cannot run until Node is available." >&2
fi

if [ "$SRC" = "$DEST" ]; then
  echo "source and destination are the same directory — nothing to do: $DEST"
  exit 0
fi

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mkdir -p "$DEST/references"
cp "$SRC/SKILL.md" "$SRC/driver.mjs" "$DEST/"
[ -f "$SRC/README.md" ] && cp "$SRC/README.md" "$DEST/"
cp "$SRC/references/"*.md "$DEST/references/"
chmod +x "$DEST/driver.mjs" 2>/dev/null || true

echo "installed $NAME → $DEST"
echo "  $(ls "$DEST/references" | wc -l | tr -d ' ') workflow templates"
echo

# The point of running this now: this skill delegates almost every step to
# another skill, and a teammate who installs only this one gets instructions
# that read perfectly and have nothing to run.
if command -v node >/dev/null 2>&1; then
  echo "Prerequisite skills (this skill orchestrates them; it does not ship them):"
  node "$DEST/driver.mjs" check 2>&1 || true
fi

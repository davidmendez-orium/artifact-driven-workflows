#!/usr/bin/env sh
# Install these Claude Code skills into a skills directory.
#
#   ./install.sh                     → ~/.claude/skills/    (all repos)
#   ./install.sh --project           → ./.claude/skills/    (this repo)
#   ./install.sh --project DIR       → DIR/.claude/skills/
#   ./install.sh --check             → report what is installed where
#   ./install.sh --uninstall         → remove them from the same target
#   ./install.sh invoke-workflow tdd → install only the named skills
#
# Each skill is a self-contained directory; copying it is a complete install.

set -eu

SRC="$(cd "$(dirname "$0")" && pwd)/skills"
MODE="install"
SCOPE="user"
PROJECT_DIR=""
WANTED=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      SCOPE="project"
      if [ $# -gt 1 ] && [ "${2#--}" = "$2" ] && [ -d "$2" ]; then PROJECT_DIR="$2"; shift; fi
      ;;
    --uninstall) MODE="uninstall" ;;
    --check)     MODE="check" ;;
    -h|--help)   sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --*) echo "unknown option: $1" >&2; exit 64 ;;
    *)   WANTED="$WANTED $1" ;;
  esac
  shift
done

[ -d "$SRC" ] || { echo "no skills/ directory next to install.sh" >&2; exit 1; }

if [ "$SCOPE" = "project" ]; then
  DEST="${PROJECT_DIR:-$PWD}/.claude/skills"
else
  DEST="$HOME/.claude/skills"
fi

# Default to every skill in the repo.
if [ -z "$WANTED" ]; then
  for d in "$SRC"/*/; do WANTED="$WANTED $(basename "$d")"; done
fi

if [ "$MODE" = "check" ]; then
  for n in $WANTED; do
    for root in "$HOME/.claude/skills" "$PWD/.claude/skills"; do
      [ -f "$root/$n/SKILL.md" ] && echo "installed: $root/$n" || echo "absent:    $root/$n"
    done
  done
  exit 0
fi

if [ "$MODE" = "uninstall" ]; then
  for n in $WANTED; do
    if [ -d "$DEST/$n" ]; then rm -rf "$DEST/$n"; echo "removed $DEST/$n"; fi
  done
  exit 0
fi

command -v node >/dev/null 2>&1 || {
  echo "WARNING: 'node' is not on PATH. invoke-workflow's resolver cannot run" >&2
  echo "         until Node is available. Other skills are unaffected." >&2
}

mkdir -p "$DEST"
COUNT=0
for n in $WANTED; do
  [ -d "$SRC/$n" ] || { echo "no such skill: $n" >&2; exit 1; }
  rm -rf "$DEST/$n"
  cp -R "$SRC/$n" "$DEST/$n"
  COUNT=$((COUNT + 1))
  echo "  installed $n"
done
echo "$COUNT skill(s) → $DEST"
echo

# invoke-workflow delegates almost every step to the others. Run its own check
# so a partial install is visible now rather than five steps into a workflow.
if [ -f "$DEST/invoke-workflow/driver.mjs" ] && command -v node >/dev/null 2>&1; then
  echo "Prerequisite check:"
  node "$DEST/invoke-workflow/driver.mjs" check 2>&1 || true
fi

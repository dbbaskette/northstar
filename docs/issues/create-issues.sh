#!/bin/bash
# Push every issue file in this directory to GitHub.
# Usage: ./create-issues.sh [--dry-run] [--filter PATTERN]
#
# Requires: gh CLI authenticated, current dir inside a GitHub repo,
# and labels mentioned in the files already exist (or use --create-labels).
set -e
cd "$(dirname "$0")"

DRY_RUN=0
CREATE_LABELS=0
FILTER="*.md"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --create-labels) CREATE_LABELS=1; shift ;;
    --filter) FILTER="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if ! command -v gh > /dev/null; then
  echo "gh CLI is required: https://cli.github.com/"
  exit 1
fi

if [ "$DRY_RUN" != "1" ] && ! gh repo view > /dev/null 2>&1; then
  echo "Not in a repo recognized by gh. Run \`git init\` and \`gh repo create\` first."
  exit 1
fi

# Pre-create labels if requested
if [ "$CREATE_LABELS" = "1" ]; then
  while IFS='|' read -r name color; do
    [ -z "$name" ] && continue
    gh label create "$name" --color "$color" --force >/dev/null 2>&1 || true
  done <<'LABELS'
P0|B60205
P1|D93F0B
P2|FBCA04
feature|0E8A16
ops|5319E7
backend|1D76DB
frontend|0075CA
area:cards|C5DEF5
area:boards|C5DEF5
area:platform|C5DEF5
area:collaboration|C5DEF5
area:integrations|C5DEF5
area:auth|C5DEF5
area:admin|C5DEF5
area:permissions|C5DEF5
area:search|C5DEF5
area:users|C5DEF5
needs:storage|FBCA04
needs:email|FBCA04
needs:cron|FBCA04
needs:slack-app|FBCA04
needs:inbound-email|FBCA04
size:large|E99695
LABELS
  echo "Labels ensured."
fi

count=0
for file in $FILTER; do
  [ "$file" = "README.md" ] && continue
  [ "$(basename "$file")" = "create-issues.sh" ] && continue
  [ ! -f "$file" ] && continue

  # Title = first H1 line (strip leading "# ")
  title=$(grep -m 1 '^# ' "$file" | sed 's/^# //')
  # Labels = the comma-separated list inside the trailing <!-- labels: ... -->
  labels=$(grep -oE '<!-- labels: [^>]+ -->' "$file" | sed -E 's/<!-- labels: ([^>]+) -->/\1/' | tr -d ' ')
  # Body = file contents minus the H1 title line and the labels footer
  body=$(grep -v '^# ' "$file" | sed '/<!-- labels:/d' | awk 'NR>1 || NF')

  if [ -z "$title" ]; then
    echo "  ! Skipping $file — no H1 title found"
    continue
  fi

  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY] $file"
    echo "      title: $title"
    echo "      labels: $labels"
  else
    label_args=""
    if [ -n "$labels" ]; then
      label_args="--label $labels"
    fi
    echo "Creating: $title"
    gh issue create --title "$title" --body "$body" $label_args
    count=$((count + 1))
  fi
done

if [ "$DRY_RUN" = "1" ]; then
  echo "Dry run complete."
else
  echo "Created $count issues."
fi

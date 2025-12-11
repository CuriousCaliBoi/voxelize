#!/usr/bin/env bash
set -euo pipefail

# Append a commit entry to notes/rust-learning-log.md and optionally bump skill
# statuses based on commit message tags like [skill:ownership] or [skill:ownership=solid].

ROOT="$(git rev-parse --show-toplevel)"
LOG_FILE="$ROOT/notes/rust-learning-log.md"

if [ ! -f "$LOG_FILE" ]; then
  echo "[rust-log] no log file found at $LOG_FILE; skipping"
  exit 0
fi

HASH_SHORT="$(git rev-parse --short HEAD)"
COMMIT_DATE="$(git log -1 --date=format:'%Y-%m-%d' --format=%ad)"
COMMIT_SUBJECT="$(git log -1 --pretty=%s)"
CHANGED_LIST="$(git diff-tree --no-commit-id --name-only -r HEAD)"
CHANGED_FILES="$(printf "%s" "$CHANGED_LIST" | tr '\n' ',' | sed 's/,$//')"
DIFF_TEXT="$(git show --pretty=format: --unified=0 HEAD)"

if grep -q "$HASH_SHORT" "$LOG_FILE"; then
  echo "[rust-log] entry for commit $HASH_SHORT already present; skipping"
  exit 0
fi

if [ -n "$CHANGED_FILES" ]; then
  BULLET="- ${COMMIT_DATE} — ${COMMIT_SUBJECT} (commit ${HASH_SHORT}; files: ${CHANGED_FILES})"
else
  BULLET="- ${COMMIT_DATE} — ${COMMIT_SUBJECT} (commit ${HASH_SHORT})"
fi

export BULLET
export COMMIT_MSG="$COMMIT_SUBJECT"
export LOG_FILE
export CHANGED_LIST
export DIFF_TEXT

python3 - <<'PY'
import os
import pathlib
import re
from typing import List

path = pathlib.Path(os.environ["LOG_FILE"])
lines: List[str] = path.read_text().splitlines()
bullet = os.environ["BULLET"]
commit_msg = os.environ["COMMIT_MSG"]

# Insert bullet under Evidence Log (latest first).
header = "## Evidence Log"
idx = next((i for i, l in enumerate(lines) if l.startswith(header)), None)
if idx is None:
    lines.append("")
    lines.append(f"{header} (auto-generated)")
    idx = len(lines) - 1

insert_at = idx + 1
while insert_at < len(lines) and lines[insert_at].strip() == "":
    insert_at += 1
lines.insert(insert_at, bullet)

# Optional skill updates driven by commit message tags and detected patterns.
# Usage: [skill:ownership] => ⚙️, [skill:ownership=solid] => ✅
tag_pairs = re.findall(r"\[skill:([a-z0-9_-]+)(?:=(solid))?\]", commit_msg, flags=re.IGNORECASE)
diff_text = os.environ.get("DIFF_TEXT", "")
changed_list = [f for f in os.environ.get("CHANGED_LIST", "").splitlines() if f]

detected_tags = set()

# Rust heuristics
if re.search(r"\benum\s+\w", diff_text):
    detected_tags.add("enum")
if re.search(r"\bmatch\b", diff_text):
    detected_tags.add("match")
if re.search(r"\bif\s+let\b", diff_text) or re.search(r"\blet\s+else\b", diff_text):
    detected_tags.add("iflet")
if re.search(r"&mut\s+\w", diff_text) or re.search(r"fn\s+\w+\s*\([^)]*&", diff_text):
    detected_tags.add("borrowing")
if re.search(r"&\[[^\]]+\]", diff_text):
    detected_tags.add("slice")
if re.search(r"\blet\s+mut\b", diff_text):
    detected_tags.add("vars")
if re.search(r"\bfn\s+\w+\s*\(", diff_text):
    detected_tags.add("functions")
if re.search(r"\bstruct\s+\w", diff_text):
    detected_tags.add("structs")
if re.search(r"///|//", diff_text):
    detected_tags.add("comments")
if re.search(r"\bfor\b|\bwhile\b|\bif\b", diff_text):
    detected_tags.add("control")

# Git heuristics
if changed_list:
    detected_tags.add("git-commit")
if any(f.startswith(".husky/") or f.startswith("scripts/update-rust-learning-log.sh") for f in changed_list):
    detected_tags.add("git-hooks")
if any(f.startswith(".cursor/") for f in changed_list):
    detected_tags.add("cursor-rules")

skill_map = {
    "vars": "3.1 Variables & mutability",
    "types": "3.2 Data types",
    "functions": "3.3 Functions",
    "comments": "3.4 Comments",
    "control": "3.5 Control flow",
    "ownership": "4.1 Ownership",
    "borrowing": "4.2 References & borrowing",
    "slice": "4.3 Slice type",
    "structs": "5.1 Defining / instantiating structs",
    "example": "5.2 Example program",
    "methods": "5.3 Method syntax",
    "enum": "6.1 Defining enums",
    "match": "6.2 match",
    "iflet": "6.3 if let / let else",
    "git-commit": "Git: commit workflow & staging",
    "git-hooks": "Git: hooks automation",
    "git-branch": "Git: branching / merging",
    "git-rebase": "Git: rebase / cherry-pick",
    "git-stash": "Git: stash",
    "git-tag": "Git: tagging / release prep",
    "cursor-rules": "Cursor: rules & automation",
    "cursor-apply": "Cursor: apply/agent usage",
    "cursor-prompts": "Cursor: custom prompts & paths",
}

def update_line(line: str, concept: str, status: str) -> str:
    parts = [p.strip() for p in line.split("|")]
    if len(parts) < 4:
        return line
    if parts[2] != concept:
        return line

    current = parts[1]
    if current == "✅" and status != "✅":
        return line
    if current == status:
        return line

    parts[1] = status
    return "| " + " | ".join(parts[1:-1]) + " |"

updates = {t: "⚙️" for t in detected_tags}
for raw_tag, solid_flag in tag_pairs:
    tag = raw_tag.lower()
    updates[tag] = "✅" if solid_flag else "⚙️"

for tag, status in updates.items():
    concept = skill_map.get(tag)
    if not concept:
        continue
    lines = [update_line(line, concept, status) for line in lines]

path.write_text("\n".join(lines) + "\n")
PY

echo "[rust-log] updated ${LOG_FILE} with commit ${HASH_SHORT}"

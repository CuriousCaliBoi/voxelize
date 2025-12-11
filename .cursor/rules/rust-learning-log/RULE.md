## Rust Learning Log Automation

**Scope**: `notes/rust-learning-log.md`, `scripts/update-rust-learning-log.sh`, `.husky/post-commit`

**Goal**: Every commit appends an evidence bullet to `notes/rust-learning-log.md` and can update skill statuses based on commit message tags or detected patterns.

### Workflow
- Husky `post-commit` calls `scripts/update-rust-learning-log.sh`.
- The script adds a bullet under `## Evidence Log` with date, short hash, subject, and changed files. It skips if the hash already exists.
- Skill bumps:
  - Commit tags: `[skill:<tag>]` → ⚙️, `[skill:<tag>=solid]` → ✅.
  - Detected patterns in the Rust diff can mark concepts as ⚙️ (e.g., `enum`, `match`, `if let`, `&mut`, `&[`, `let mut`, `struct`, `fn`, comments, control-flow keywords).
- Git signals: any commit sets `Git: commit workflow & staging` to ⚙️; changes in `.husky/` or the updater script set `Git: hooks automation` to ⚙️.
- Cursor signals: touching `.cursor/` sets `Cursor: rules & automation` to ⚙️. Use tags for other Cursor concepts.
- The hook runs after the commit, so the log will often be dirty; stage and amend or include it in the next commit.

### Maintenance
- Ensure Husky is installed (`pnpm husky install`) if hooks are not firing.
- Keep the status tables and evidence list in `notes/rust-learning-log.md` aligned with skill tags and heuristics (including Cursor and Git skills).
- If the log format changes, update `scripts/update-rust-learning-log.sh` accordingly.

## Rust Learning Log Automation

**Scope**: `notes/rust-learning-log.md`, `scripts/update-rust-learning-log.mjs`, `.husky/post-commit`

**Goal**: Every commit appends an evidence bullet to `notes/rust-learning-log.md` and updates skill statuses using an AI model (given the commit diff + current log context).

### Workflow
- Husky `post-commit` calls `node scripts/update-rust-learning-log.mjs`.
- The updater collects:
  - latest commit hash/date/subject
  - list of changed files
  - the commit diff
  - the current `notes/rust-learning-log.md`
- It asks an AI model to output the **full updated markdown** (no commentary): add a new bullet under `## Evidence Log` and bump skill statuses as appropriate (never downgrading ✅).

### AI Configuration
The updater uses an **OpenAI-compatible Chat Completions API**.

Set these env vars (shell, `.envrc`, CI secrets, etc.):
- `RUST_LOG_AI_BASE_URL` (default `https://api.openai.com/v1`)
- `RUST_LOG_AI_API_KEY` (or `OPENAI_API_KEY`)
- `RUST_LOG_AI_MODEL` (default `gpt-4o-mini`)

Local model option (if you have an OpenAI-compatible local endpoint):
- point `RUST_LOG_AI_BASE_URL` at it (e.g. `http://localhost:11434/v1`)

### Optional commit tags (to help the model)
- `[skill:<tag>]` → mark relevant concept as ⚙️
- `[skill:<tag>=solid]` → mark relevant concept as ✅

### Notes
- Post-commit means the log will be modified after committing; it’s normal for `notes/rust-learning-log.md` to become dirty. Include it in the next commit or amend if you prefer.
- If AI isn’t configured or fails, the updater falls back to a minimal deterministic update (so you still get an Evidence Log entry).

### Maintenance
- Ensure Husky is installed (`pnpm run prepare`) if hooks are not firing.
- If the log format changes drastically, adjust the prompt/validation logic in `scripts/update-rust-learning-log.mjs`.

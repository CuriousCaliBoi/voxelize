# Rust Learning Log

Track Rust concepts practiced inside `voxelize-brisingr`, with concrete evidence from changes or runs. Update this file whenever a new concept is exercised.

## Status Legend
- ✅ Solid
- ⚙️ In progress / partially used
- ⬜ Not yet practiced

## Skills Snapshot
| Status | Concept | Evidence / Notes |
| --- | --- | --- |
| ⬜ | 3.1 Variables & mutability | Plan a small mutable counter in a stage helper |
| ⚙️ | 3.2 Data types | Used integer ranges in chunk loops (`LimitedStage`) |
| ⚙️ | 3.3 Functions | Added simple helper (`double`) while testing server logs |
| ⬜ | 3.4 Comments | Add doc comments to new helpers (todo) |
| ⚙️ | 3.5 Control flow | `if` guard + nested `for` loops in `LimitedStage` |
| ⬜ | 4.1 Ownership | Practice passing resources by value vs borrow (todo) |
| ⬜ | 4.2 References & borrowing | Refactor stage helpers to take `&mut Chunk` (todo) |
| ⬜ | 4.3 Slice type | Accept height samples as `&[i32]` in helpers (todo) |
| ⚙️ | 5.1 Defining / instantiating structs | Worked with `LimitedStage` and engine structs |
| ⬜ | 5.2 Example program | Write a focused helper to demonstrate struct usage |
| ⚙️ | 5.3 Method syntax | Implemented `ChunkStage` for `LimitedStage` |
| ⬜ | 6.1 Defining enums | Introduce a `Biome` enum in terrain stage (todo) |
| ⬜ | 6.2 match | Replace nested `if` with `match` on biome (todo) |
| ⬜ | 6.3 if let / let else | Use `Space` option in a stage (todo) |

## Git Skills Snapshot
| Status | Concept | Evidence / Notes |
| --- | --- | --- |
| ⚙️ | Git: commit workflow & staging | Hook appends per-commit evidence to this log |
| ⚙️ | Git: hooks automation | Post-commit hook updates learning log |
| ⬜ | Git: branching / merging | Practice branch flow and merges (todo) |
| ⬜ | Git: rebase / cherry-pick | Rehearse non-fast-forward workflows (todo) |
| ⬜ | Git: stash | Use stash/pop in a feature flow (todo) |
| ⬜ | Git: tagging / release prep | Tag a build and note artifacts (todo) |

## Cursor Skills Snapshot
| Status | Concept | Evidence / Notes |
| --- | --- | --- |
| ⚙️ | Cursor: rules & automation | Added `.cursor/rules/rust-learning-log/RULE.md` and hooked post-commit updater |
| ⬜ | Cursor: apply/agent usage | Practice inline edits and Apply with Cursor (todo) |
| ⬜ | Cursor: custom prompts & paths | Define scoped rules for other areas (todo) |

## Evidence Log (chronological)
- 2025-12-11 — true dev mode (flag so packages are watched as well) (commit a72b5caa; files: package.json)
- 2025-12-11 — Added post-commit hook and Cursor rule to auto-update the Rust learning log and infer skill bumps from commit diffs.
- 2025-12-11 — Ran the Voxelize demo end-to-end (server + client). Added a small `double` helper in `examples/server/main.rs` to confirm server logs and basic function usage.
- 2025-12-11 — Practiced control flow and ranges in `LimitedStage` (`examples/server/worlds/shared/stage.rs`): guarded island bounds, then filled voxels with nested `for` loops and registry lookups.

## How to Update
1) Add a new bullet under “Evidence Log” with date, change, and files touched.  
2) Adjust the status table rows that the change exercised.  
3) Keep evidence specific (file paths, behavior observed).  
4) When a topic feels solid, switch its status to ✅ and note why.

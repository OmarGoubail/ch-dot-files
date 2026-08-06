---
name: elixir-review-memory
description: Provides QMD-backed conventions for persistent Elixir PR review lessons and warns reviewers not to write memory without explicit persistence approval.
---

# Elixir Review Memory

Use this skill during Elixir/Phoenix PR review to read durable lessons from QMD, and during explicit learning workflows to persist human-review lessons in the shared knowledge vault.

## Memory location

Review memory lives in the QMD collection `knowledge`, backed by `~/Documents/knowledge`. It is not stored under `~/.pi` or inside repository working trees.

The migrated global note is:

- `qmd://knowledge/topics/reviewer-patterns.md`

New notes are append-only:

- Global patterns: `qmd://knowledge/topics/review-patterns/*.md`
- Repo-specific patterns: `qmd://knowledge/projects/<repo>/review-patterns/*.md`
- Global reflections: `qmd://knowledge/topics/review-reflections/*.md`
- Repo-specific reflections: `qmd://knowledge/projects/<repo>/review-reflections/*.md`

Set `QMD_KNOWLEDGE_ROOT` when the vault is not at `~/Documents/knowledge`. Each machine must register that directory as the `knowledge` QMD collection and run `qmd update`; embeddings can be refreshed with `qmd embed -c knowledge`.

## Extension commands and tool

The `elixir-review` Pi extension provides:

- `/elixir-review status` — show QMD status and repo detection.
- `/elixir-review init` — verify the QMD vault and collection.
- `/elixir-review prompt [scope]` — place a normal review prompt in the editor. This workflow reads memory only.
- `/elixir-review learn <PR-or-label>` — place a learning prompt in the editor. Invoking this command is explicit approval to persist durable review-memory entries for that learning task.

The extension-backed `review_memory` tool supports:

- `status` — report QMD status and review-memory paths.
- `read` — read QMD-backed global and repo pattern notes by default; `scope` may be `global`, `repo`, or `both`.
- `append_pattern` — create a new Markdown pattern note under the selected QMD scope. `pattern` is required; omitted scope defaults to `repo`; `both` creates one note in each pool.
- `write_reflection` — create a new Markdown reflection note. `label` and `reflection` are required; `global` writes under the global pool and omitted, `repo`, or `both` writes under the repo pool.

Use `review_memory` for memory writes instead of generic file writes. Writes refresh the QMD index and embeddings; the knowledge repository remains the source of truth.

## How reviewers use memory

At ordinary review start:

1. Call `review_memory` with `action: "read"` and `scope: "both"`.
2. Read the migrated global note and any repo-specific QMD notes.
3. Apply relevant entries as a lens, not as unquestioned truth. Verify every finding in the current diff.

In the final review, mention whether memory was consulted:

- `Memory: read global and repo-specific QMD review-pattern notes.`
- `Memory: no QMD review memory found.`
- `Memory: skipped because this was not an Elixir/Phoenix repo.`

Do not call `append_pattern` or `write_reflection` during an ordinary `/elixir-review prompt` review unless the user explicitly asked to persist lessons.

## Learning from human feedback

Use `/elixir-review learn <PR-or-label>` after human PR feedback or other explicit user instruction to persist lessons.

For PR-number labels, the generated prompt tells the agent to use read-only `gh` commands such as `gh pr view`, `gh api repos/<owner>/<repo>/pulls/<n>/comments`, and `gh api repos/<owner>/<repo>/issues/<n>/comments`, filter bots/automation, compare human feedback with the review and diff context, and persist only non-sensitive reusable patterns.

For non-PR labels, the generated prompt uses human feedback pasted in the conversation or editor as the source of truth.

Scope rules:

- Repo-specific reviewer or project preferences go to `scope: repo`.
- Generally reusable Elixir/Phoenix lessons may go to `scope: global`.
- Use `scope: both` only when the same pattern belongs in both pools.
- Write no pattern if there is no durable lesson.
- Record detailed per-PR/per-label reflections with `write_reflection`; create new notes rather than overwriting existing notes.

## What not to do

- Do not treat memory as a substitute for reading code.
- Do not store secrets, private customer data, tokens, or confidential PR text unnecessarily.
- Do not write memory during leaf reviewer subagent reviews unless persistence was explicit.
- Do not overwrite existing QMD notes.

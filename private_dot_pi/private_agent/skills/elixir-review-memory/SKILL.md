---
name: elixir-review-memory
description: Provides extension-backed conventions for persistent Elixir PR review lessons and warns reviewers not to write memory without explicit persistence approval.
---

# Elixir Review Memory

Use this skill during Elixir/Phoenix PR review to read durable lessons, and during explicit learning workflows to persist human-review lessons.

## Memory Location

Review memory is stored centrally under `~/.pi/review-memory/`, never inside each repo's working tree.

Use two pools inside that directory:

1. Global reusable lessons: `~/.pi/review-memory/patterns.md` and `patterns.json`
2. Source-repo lessons: `~/.pi/review-memory/repos/<repo>/patterns.md`, `patterns.json`, and `prs/`

Repo-specific lessons keep their source context without creating `.pi/review-memory/` inside every repository. Promote a repo lesson to the global pool only when it is generally useful beyond that repo.

## Extension Commands and Tool

The `elixir-review` Pi extension provides:

- `/elixir-review status` — show memory paths and repo detection.
- `/elixir-review init` — create the global pool and current repo bucket.
- `/elixir-review prompt [scope]` — place a normal review prompt in the editor. This workflow reads memory only.
- `/elixir-review learn <PR-or-label>` — initialize memory dirs and place a learning prompt in the editor. Invoking this command is explicit approval to persist durable review-memory entries for that learning task.

The extension-backed `review_memory` tool supports:

- `status` — report memory status.
- `read` — read global and repo memory by default; `scope` may be `global`, `repo`, or `both`.
- `append_pattern` — append markdown to `patterns.md`. `pattern` is required. If `scope` is omitted, it defaults to `repo`; explicit `scope: both` appends to both global and repo files.
- `write_reflection` — write a reflection markdown file. `label` and `reflection` are required. It writes a unique `prs/<YYYY-MM-DD>-<slug>.md` under the repo bucket by default; `scope: global` writes under the global pool. Omitted or `both` scope uses repo for reflections.

Use `review_memory` for memory writes instead of generic file writes.

## How Reviewers Use Memory

At ordinary review start:

1. Check the global pool: `~/.pi/review-memory/patterns.md` and `patterns.json`.
2. Check the current repo bucket if it exists: `~/.pi/review-memory/repos/<repo>/patterns.md` and `patterns.json`.
3. Read relevant entries before finalizing findings.
4. Apply memory as a lens, not as unquestioned truth. Verify every finding in the current diff.

In the final review, mention whether memory was consulted:

- `Memory: read global and repo-specific ~/.pi/review-memory entries.`
- `Memory: no review memory found.`
- `Memory: skipped because this was not an Elixir/Phoenix repo.`

Do not call `append_pattern` or `write_reflection` during an ordinary `/elixir-review prompt` review unless the user explicitly asked to persist lessons.

## Learning From Human Feedback

Use `/elixir-review learn <PR-or-label>` after human PR feedback or other explicit user instruction to persist lessons.

For PR-number labels, the generated prompt tells the agent to use read-only `gh` commands such as `gh pr view`, `gh api repos/<owner>/<repo>/pulls/<n>/comments`, and `gh api repos/<owner>/<repo>/issues/<n>/comments`, filter bots/automation, compare human feedback with the review and diff context, and persist only non-sensitive reusable patterns.

For non-PR labels, the generated prompt uses human feedback pasted in the conversation or editor as the source of truth.

Scope rules:

- Repo-specific reviewer or project preferences go to `scope: repo`.
- Generally reusable Elixir/Phoenix lessons may go to `scope: global`.
- Use `scope: both` only when the same pattern belongs in both files.
- Write no pattern if there is no durable lesson.
- Record detailed per-PR/per-label reflections with `write_reflection`; do not overwrite existing memory.

## What Not To Do

- Do not treat memory as a substitute for reading code.
- Do not store secrets, private customer data, tokens, or confidential PR text unnecessarily.
- Do not write memory during leaf reviewer subagent reviews unless persistence was explicit.
- Do not overwrite existing memory without preserving prior entries.

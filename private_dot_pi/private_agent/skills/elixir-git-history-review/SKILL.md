---
name: elixir-git-history-review
description: Reviews Elixir/Phoenix changes against git blame and log history to distinguish pre-existing issues, recover prior decisions, and catch regressions without destructive git operations.
---

# Elixir Git History Review

Use this skill when a review needs historical context: deleted code, changed query semantics, removed guards, behavior reversals, unclear legacy constraints, or distinguishing regressions from pre-existing issues.

## Review Contract

Ask: **Does git history show that this change accidentally reverses a prior decision, reintroduces a fixed bug, or should be classified as pre-existing rather than introduced?**

This is an evidence-gathering review lens. It should improve attribution and confidence, not produce speculative archaeology.

## Safety Rules

Allowed:

- `git status`, `git diff`, `git diff --cached`
- `git log`, `git show`, `git blame`
- `git branch --show-current`, `git merge-base`
- read-only grep/search commands

Forbidden unless the user explicitly asks:

- `git reset`, `git checkout`, `git restore`, `git clean`, `git rebase`, `git merge`, `git commit`, `git push`
- Any command that rewrites, deletes, stages, or switches user work.

## Evidence Rules

1. Start from the changed files and changed lines. Do not inspect history for unrelated code.
2. Focus on meaningful changes: removed checks, changed filters, deleted functions, altered return shapes, data migrations, auth/scoping changes, or deploy-sensitive behavior.
3. Use commit messages and old code to understand intent; do not overfit to a single word in a commit title.
4. Verify whether the current PR preserves the old behavior through another path before flagging.
5. Use history to classify findings as introduced, reintroduced, or pre-existing.

## Scope Triggers

| Change | Historical question |
| --- | --- |
| Removed guard/auth/filter | Was it added to fix a bug or enforce policy? |
| Changed query joins/scopes/order | Was old shape intentional for edge cases/performance? |
| Deleted function/module/field | Are callers/jobs/clients still relying on it? |
| Changed migration/schema behavior | Was prior migration staged for rollout safety? |
| Reworked tests | Did tests previously encode an important regression case? |
| Confusing legacy code | What decision led to this shape? |
| Suspected pre-existing bug | Did the PR introduce or merely expose it? |

## Basic Workflow

1. Read the diff and identify the 1-5 most historically significant changes.
2. For each changed file, inspect recent file history:

```bash
git log --oneline -20 -- path/to/file.ex
```

3. For changed or deleted lines, inspect blame:

```bash
git blame -L <start>,<end> -- path/to/file.ex
```

4. For deleted functions/fields/patterns, inspect semantic history:

```bash
git log --all -S "function_or_field_name" --oneline -- path/to/file.ex
git show <commit> -- path/to/file.ex
```

5. Search for related tests or follow-up commits when a commit message mentions a bug, incident, rollback, migration, or customer issue.

## What to Look For

Historical evidence is useful when it shows:

- A removed condition was added in response to a bug, security issue, performance incident, or deploy failure.
- A broad query/filter was intentionally broadened or narrowed for a known edge case.
- A return shape or error branch exists because callers rely on it.
- A test was added for a regression and the PR removes or weakens it.
- A migration was staged across multiple commits and the PR collapses stages unsafely.
- A field/function/module looks unused now but is referenced by jobs, serialized data, external clients, or older deployments.
- A suspected issue predates the PR and should not block unless the PR makes it worse.

## Blame Interpretation

Be careful with blame:

- Formatting commits can obscure original authorship. Use `git blame -w` if whitespace churn is suspected.
- A line's latest commit may not explain the original decision. Use `git log -S` or inspect earlier commits.
- Merge commits may hide the PR number in the message; inspect `git show` for context.
- Generated or moved code often needs `git log --follow -- path` for renamed files.
- Lack of useful history is not evidence of safety or risk.

## Regression Classification

Classify historical issues clearly:

- **Introduced by this change:** The PR removes or changes behavior and no equivalent protection remains.
- **Reintroduced regression:** History shows the same pattern was previously fixed and the PR brings it back.
- **Pre-existing:** The issue was already present before this PR; mention only if relevant to review or user request.
- **Intentional reversal:** The PR or surrounding code clearly updates the old decision; do not flag unless the new rationale is incomplete or unsafe.
- **Unknown:** History is inconclusive; do not overstate.

## Applying to Elixir/Phoenix

Common high-value checks:

- Auth and tenant scope changes in contexts, controllers, LiveViews, resolvers, plugs, and policies.
- Ecto query filters, preload choices, `distinct`, `limit`, ordering, and transaction boundaries.
- Changeset validations and constraints that prevent data integrity issues.
- Oban/job retry behavior and argument shapes.
- LiveView `handle_params`, `handle_event`, and `mount` ordering.
- Tests named for regressions or bug IDs.
- Migration staging and rollback behavior.

## Output Guidance

Report findings only when history changes the review outcome or confidence:

- File/line in current code.
- Historical commit(s) inspected.
- What old code did and why.
- What the PR changes.
- Whether the issue is introduced, reintroduced, pre-existing, or intentional.
- Minimal fix or follow-up question.

Use `[blocking]` only when history reveals a likely regression or unsafe reversal that the PR does not address. Use `[observation]` for useful attribution or context.

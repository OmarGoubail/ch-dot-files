---
name: elixir-prior-comments-review
description: Reviews current Elixir/Phoenix changes against prior GitHub PR comments and review memory to catch recurring feedback and project-specific lessons when gh is available.
---

# Elixir Prior Comments Review

Use this skill for every PR-number review where GitHub is available, not only for old comments. Current human PR reviews/comments are first-class review context and must not be buried as residual risk.

## Current PR Human Comments

For the current PR, fetch read-only review context:

```bash
gh pr view <N> --json reviews,comments
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/$REPO/pulls/<N>/comments" --paginate
gh api "repos/$REPO/issues/<N>/comments" --paginate
```

Filter out bots such as `coderabbit`, `github-actions`, `dependabot`, `renovate`, and logins ending in `[bot]`. For human comments:

- Summarize explicit requested changes, questions, and coverage gaps.
- Cross-check them against the current diff and tests.
- If a human asked for tests or changes, report it in `Human review context` and also in `Non-blocking findings` when it is actionable but not blocking.
- State whether you agree, disagree, or could not verify.
- Do not claim all reviewers found no findings while unresolved human requested changes exist.


Use this skill when reviewing a PR in a GitHub-backed Elixir/Phoenix repo and prior human/bot feedback may reveal recurring project conventions, reviewer preferences, or lessons that apply to the current diff.

## Review Contract

Ask: **Have reviewers already discussed this file, pattern, or pitfall in a way that applies to the current change?**

This skill should surface recurring, relevant feedback. It must not block on stale, stylistic, or unrelated prior comments.

## Graceful Degradation

This lens depends on local git history and optionally `gh`:

- If `gh` is unavailable, unauthenticated, or no PR context exists, skip GitHub comment lookup and say so.
- If there is no network access or API permission, skip gracefully.
- If `elixir-review-memory` is available, read memory even when `gh` is unavailable.
- Do not require prior comments to complete a normal code review.

## Evidence Rules

1. Start with changed files and changed functions. Do not scrape unrelated PRs.
2. Prefer recent merged PRs that touched the same file, function, component, context, or migration area.
3. Distinguish current PR comments from prior PR comments.
4. Filter bot comments unless they cite a concrete project rule, failed check, or real bug.
5. Verify the current code still has the same pattern before reporting prior feedback.
6. Do not re-raise a comment that was already addressed by the current PR description or discussion.

## Scope Triggers

| Situation | Use this lens |
| --- | --- |
| Repeated changes in the same LiveView/context/schema | Check prior file comments |
| Unclear local convention | Search prior review feedback |
| Human reviewer mentioned a pattern before | Verify recurrence |
| Review memory exists | Cross-check current diff |
| PR has active comments | Avoid duplicating already-addressed feedback |
| Generated or bot-heavy reviews | Filter for durable lessons |

## Review Memory Cross-Check

If `elixir-review-memory` is loaded or discoverable:

- Read project/global lessons before forming findings.
- Apply only lessons that match the current repo and changed code.
- If a prior comment reveals a durable lesson, mention that it may be worth recording through the memory skill after human confirmation.
- Do not invent memory entries during review unless the task explicitly asks for reflection.

## Discover Current Scope

Use the best available source:

```bash
# Current PR when available
gh pr view --json number,title,body,comments,reviews

gh pr diff --name-only

# Local fallback
git diff --name-only main...HEAD
git diff --name-only
git diff --cached --name-only
```

If a PR number is provided, pass it explicitly to `gh pr view` and `gh pr diff`.

## Find Relevant Prior PRs

For each important changed file, use git and GitHub together:

```bash
git log --oneline --merges -20 -- path/to/file.ex
git log --oneline -20 -- path/to/file.ex

gh pr list --state merged --limit 10 --search "path_or_feature_keyword in:title,body" --json number,title,mergedAt,author
```

Prioritize:

- PRs that touched the exact same file/function.
- PRs with titles matching the same feature/domain.
- PRs by the same team or recent timeframe.
- PRs whose merge commits appear in the file history.

Avoid spending the whole review budget on archaeology; sample the most relevant 5-10 PRs.

## Read Comments

When `gh` is available:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

gh api "repos/$REPO/pulls/<N>/comments" \
  --jq '.[] | {path: .path, line: .line, body: .body, user: .user.login}'

gh api "repos/$REPO/pulls/<N>/reviews" \
  --jq '.[] | select(.body != "") | {body: .body, user: .user.login, state: .state}'

gh pr view <N> --comments --json comments --jq '.comments[].body'
```

For the current PR, read open comments/reviews to avoid duplicate findings and to understand author responses.

## Relevance Filter

Keep a prior comment only if:

- It describes a project convention, bug pattern, deploy constraint, security issue, or test expectation.
- The current PR introduces or modifies the same pattern.
- The old comment is not purely personal style.
- The old comment was not invalidated by later architecture changes.
- You can point to current code where it applies.

Drop comments that are:

- About unrelated lines in the same file.
- Bot-only style suggestions without durable project value.
- Already addressed in the current PR.
- Pre-existing and not worsened.
- Too vague to act on.

## Applying to Elixir/Phoenix

High-value recurring feedback often involves:

- LiveView assigns, `handle_params`, modals, and component boundaries.
- Ecto query scoping, preloads, transactions, and migrations.
- Auth/tenant ownership checks.
- Factory/fixture conventions and async test safety.
- Oban job idempotency and deploy sequencing.
- Project-specific utilities instead of local helpers.
- Return tuple conventions and context API shape.

## Output Guidance

Report only applicable comments as review findings or observations:

- File/line in current PR.
- Source PR/comment author if available.
- Short quote or faithful summary of the prior feedback.
- Why it applies to the current code.
- Whether current discussion already addressed it.
- Minimal action.

Use `[blocking]` only when the prior feedback maps to a concrete correctness, security, deploy, or test blocker. Otherwise use `[observation]`.

If skipped, report: `Prior comments skipped: <gh unavailable/no PR/no relevant prior PRs/auth issue>.` If no applicable comments are found, say so explicitly.

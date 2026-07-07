---
name: elixir-pr-review
description: Reviews Elixir and Phoenix PRs by detecting changed file types, loading focused Elixir review skills, running project checks, and reporting only blocker findings.
---

# Elixir PR Review

Use this skill when reviewing an Elixir, Phoenix, LiveView, Ecto, Oban, or Mix project. It is the coordinator skill: it decides which focused review lenses to apply, then synthesizes the final blocker-focused review.

## Review Contract

Answer one question first: **Can this PR ship without blocking the user or developer?**

Prefer approval when the change is directionally correct and checks pass. Reject only for blockers: broken behavior, failed relevant checks, unsafe data operations, security leaks, missing required tests for risky behavior, or ignored project conventions that will break maintainability.

Do not suppress verified non-blocking findings. Report them separately as advisory findings so the user can inspect coverage gaps, human-requested changes, medium/low risks, and maintainability concerns without confusing them with blockers.

## Before Reviewing

1. Read the user request and changed-file scope directly.
2. If the user provided a PR number, resolve that PR with read-only `gh` commands before reviewing:
   - `gh pr view <N> --json number,title,body,baseRefName,headRefName,headRepositoryOwner,headRepository,state,url,author,additions,deletions,changedFiles`
   - `gh pr diff <N> > /tmp/pi-elixir-review/pr-<N>.patch`
   - `gh pr diff <N> --name-only > /tmp/pi-elixir-review/pr-<N>-files.txt`
   Do not assume the current branch equals the PR. Compare PR base/head to `git branch --show-current` and the local diff if you plan to use local files/tests. If they do not match, review the PR patch as source of truth and clearly say local execution was skipped or requires checkout.
3. For current-change reviews without a PR number, state the local branch and diff range used, including whether uncommitted changes were included.
4. Read any project instructions: `AGENTS.md`, `CLAUDE.md`, `.formatter.exs`, `mix.exs`, `config/*.exs`, CI config.
5. If present, load `elixir-review-memory` and read memory before forming findings.
6. Inspect local patterns before critiquing deviations. Do not import Jump-specific rules blindly into other repos.
7. Decide which focused skills apply:
   - `elixir-liveview-review`: LiveViews, LiveComponents, HEEx, component modules, uploads, JS commands.
   - `elixir-ecto-review`: schemas, migrations, contexts, changesets, queries, transactions, data access.
   - `elixir-testing-review`: `*_test.exs`, test support, factories/fixtures, async tests, mocks, Oban assertions.
   - `elixir-security-review`: auth, tenant/account scoping, IDOR, XSS, injection, mass assignment, secrets, uploads, redirects.
   - `elixir-deploy-risk-review`: migrations, backfills, rolling deploys, feature flags/capabilities, jobs, rollback, idempotency.
   - `elixir-maintainability-review`: duplication, over-abstraction, LLM bloat, local consistency, dead code, complexity.
   - `elixir-code-contracts-review`: moduledocs, specs, comments, public APIs, behavior callbacks, routes/params, documented behavior.
   - `elixir-git-history-review`: blame/log/show context for regressions, prior decisions, and pre-existing issues.
   - `elixir-prior-comments-review`: prior GitHub review comments and review-memory lessons when available.
   - `elixir-adversarial-review`: skeptical second-pass review for risky or high-impact diffs.
   - `jump-elixir-review`: Jump-specific conventions such as `JumpWeb`, `Jump.Schema`, `PhoenixTest`, `Hammox`, component hierarchy, helper APIs, and internal safety patterns. Use only in Jump repos or when explicitly requested.

## Scope Detection

Use the diff or changed file list.

| Changed files or behavior | Required review lens |
| --- | --- |
| `*.ex`, `*.exs` | Elixir idioms and project checks |
| `*_live.ex`, `*_live.html.heex`, `*.html.heex`, component modules | `elixir-liveview-review` |
| `priv/repo/migrations/*.exs`, schema/context/query files | `elixir-ecto-review` |
| `test/**/*_test.exs`, `test/support/**` | `elixir-testing-review` |
| Auth, account, tenant, resolver, controller, LiveView access code, uploads, redirects, raw HTML, tokens, secrets | `elixir-security-review` |
| Migrations, config/env, feature flags, capabilities, registries, workers, jobs, schedulers, deploy notes | `elixir-deploy-risk-review` |
| New helpers/modules/APIs, large additions, duplicated patterns, generated code, dead code, broad fallbacks, defensive normalization | `elixir-maintainability-review` |
| Changed public APIs, docs/specs/comments, callbacks, routes/params, response shapes, documented behavior, prompt/execution contracts, logging metadata builders | `elixir-code-contracts-review` |
| Removed guards/functions/tests, changed query semantics, suspicious legacy behavior, attribution questions | `elixir-git-history-review` |
| GitHub PR context available and recurring project feedback may apply | `elixir-prior-comments-review` |
| Risky/security/deploy-sensitive diff, large PR, side effects in logging/prompt/execution paths, persisted logs/metadata, sensitive data, or need for independent skeptical pass | `elixir-adversarial-review` |
| Strong Jump repo signals such as `JumpWeb`, `Jump.Schema`, `Jump.PubSub`, `Jump.Guardian`, `PhoenixTest`, `Hammox`, or explicit user request for Jump standards | `jump-elixir-review` |
| Workers, jobs, tasks, external calls | Runtime safety, retries, idempotency, plus `elixir-deploy-risk-review` when deployment behavior can change |

## Baseline Elixir Checks

Run project-native checks, not just generic Mix defaults. Prefer targeted checks first.

### Check discovery

Before running checks, inspect:

- `AGENTS.md`, nested `AGENTS.md`, `CLAUDE.md`, README/dev docs, and CI config.
- `mix.exs` aliases, especially `aliases/0`, `deps/0`, Credo/Dialyzer deps, project-specific tasks, and umbrella/app layout.
- `.formatter.exs`, `.credo.exs`, `config/test.exs`, and test support files when relevant.

If repo instructions name a command, that command is authoritative unless unsafe or too expensive. Examples: `mix jump.ci.lint`, `mix credo`, `mix credo --strict`, `mix format --check-formatted`, project test aliases, or changed-file test commands.

### Typical command order

- Project-required lint/check command from guidelines, e.g. `mix jump.ci.lint`, when available and reasonably bounded.
- `mix format --check-formatted <changed .ex/.exs/.heex files>` or project formatting command.
- `mix test path/to/changed_or_related_test.exs` for changed tests or behavior.
- `mix compile --warnings-as-errors` when dependencies are available and compile is reasonable.
- `mix credo` / `mix credo --strict` only if Credo is configured or required by repo guidelines.
- `mix test` when the scope is broad and the suite is reasonable.
- `mix dialyzer` only if it is part of normal project checks or explicitly requested.

If a command is unavailable, expensive, needs secrets, starts services, requires checking out a different PR branch, or depends on missing services, state that clearly in `Checks` rather than guessing.

## Elixir Review Lens

Check for blockers in these areas:

### Correctness
- Pattern matches assert the expected shape instead of broad defensive fallbacks.
- Broad fallbacks and defensive normalization in changed logging metadata builders, prompt/execution paths, or core business paths trigger maintainability and contracts review; add security/adversarial when they involve side effects, persisted logs, or sensitive data.
- `nil` handling represents expected absence, not hidden bugs.
- Bang functions are used only when crashing is correct for an invariant.
- `with`/`case` branches preserve enough error information for callers.
- Async, Task, GenServer, PubSub, and Oban work is supervised or retried appropriately.

### Phoenix Boundaries
- Controllers, LiveViews, channels, and resolvers call context functions instead of owning business logic.
- Authorization and tenant scoping happen before data is exposed or mutated.
- Flash/errors are surfaced at the web boundary; expected user errors do not crash.
- External input is validated and normalized at the boundary.

### Data and Side Effects
- Database writes are transactional when multiple related changes must succeed or fail together.
- Background jobs are idempotent when retries can happen.
- Emails, webhooks, and external side effects are not emitted before durable state commits.
- Logging/audit metadata construction is pure, cheap, and gated when logging is disabled; expensive or side-effectful builders count as production behavior.
- Migrations are safe for deployed systems.

### Security
- No IDOR/cross-account access through unscoped IDs.
- No secrets in logs, errors, tests, or fixtures.
- HEEx output relies on escaping; raw HTML is justified and sanitized.
- File uploads validate size/type server-side and avoid user-controlled paths.

## Synthesis Rules

1. Deduplicate findings across focused skills.
2. Verify each blocker by reading the relevant code; do not report unverified suspicions.
3. Separate pre-existing problems from regressions introduced by the PR.
4. Prefer one precise finding over a list of vague style concerns.
5. Include file path and line for every finding whenever possible. Use `path:line` or `path:start-end`. If reviewing a patch only, derive locations from hunk line numbers; if no stable line exists, write `line unknown` and explain why.

## Output

Output all verified findings, split by severity, and include evidence so the parent/user can audit what you actually did:

```markdown
Reviewed source: <PR via gh diff | checked-out PR branch | local diff range>
Verdict: <Approved | Changes requested>

Review lens:
- Assigned lens: <baseline | LiveView/HEEx | Ecto/data/deploy | security/auth | testing/contracts | maintainability | etc.>
- Looked for: <issue classes actively checked>
- Out of scope: <areas intentionally not reviewed by this subagent>

Review evidence:
- Source inspected: <patch/files/diff range>
- Instructions/config read: <AGENTS.md, CLAUDE.md, mix.exs aliases, CI, etc.>
- Local patterns checked: <specific rg/read checks such as PhoenixTest vs LiveViewTest, nearby components, existing context APIs>
- Verified true: <facts established from code>
- Not verified: <important checks skipped and why>

Checks:
- <command with cwd> — pass/fail/skipped and why

Blocking findings:
- [blocking] path/to/file.ex:42 — What breaks, why it matters, and the minimal fix.
- None.

Non-blocking findings:
- [medium|low|info] path/to/file.ex:42 — Advisory issue, coverage gap, human-requested change, or risk; include why it is non-blocking.
- None.

Human review context:
- <unresolved human comments and whether this review agrees/disagrees/could not verify>

Memory: <memory consulted or not present>
Residual risks: <meaningful risks not captured above, or none>
```

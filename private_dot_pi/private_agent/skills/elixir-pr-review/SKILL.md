---
name: elixir-pr-review
description: Reviews Elixir and Phoenix changes with one baseline covering correctness, web boundaries, data/deploy safety, testing, security, contracts, maintainability, and useful history. Routes only Jump-specific conventions to the optional Jump overlay.
---

# Elixir PR Review

Use this skill for Elixir, Phoenix, LiveView, Ecto, Oban, or Mix reviews. Apply the relevant sections internally; do not load a separate focused review skill for any section below. The only optional review overlay is `jump-elixir-review` for verified Jump repositories.

## Review contract

Answer first: **Can this change ship without blocking the user, developer, data, or deploy?** Block only verified regressions, failed required checks, unsafe data/deploy operations, exploitable security issues, broken contracts, or missing tests that leave risky behavior unverified. Keep advisory, coverage, and human-requested items separate; do not suppress verified non-blockers.

## Source of truth and setup

1. Read the request, exact changed-file scope, full changed files, and relevant callers/tests.
2. For a PR number, resolve it with read-only `gh` commands before reviewing: fetch metadata, `gh pr diff`, changed names, review comments, and issue comments. Compare PR base/head with `git branch --show-current`, repository root, status, and local diff. If the checked-out head does not match, use the fetched patch as source of truth, derive patch line numbers from hunks, and state that local checks were skipped; never silently substitute `main...HEAD` or check out/mutate the worktree.
3. For local changes, state the branch and exact range used (normally `git diff main...HEAD` plus uncommitted changes, if present). Include staged changes when relevant.
4. Read `AGENTS.md`, `CLAUDE.md`, README/development docs, CI config, `.formatter.exs`, `mix.exs` aliases/deps, relevant `config/*.exs`, and test support. Inspect nearby code for project-native patterns before flagging deviations.
5. Read global and repo review memory through `review_memory read` when present. Memory is a verification lens, never proof; ordinary reviews are read-only. Do not append patterns or write reflections unless `/elixir-review learn` or another explicit persistence request authorizes it.
6. If the repo has strong Jump signals (`JumpWeb`, `Jump.Schema`, `Jump.PubSub`, `Jump.Guardian`, or project instructions), route the optional `jump-elixir-review` overlay; otherwise do not apply Jump-only rules.

## Baseline correctness

- Trace changed inputs through callers, branches, return values, side effects, and failure paths. Prefer precise pattern matches, guards, `case`, and `with`; ensure `nil` means an intentional absence and bang functions fail only on true invariants.
- Preserve error information at boundaries. Do not hide malformed shapes, unexpected states, exceptions, or failed tasks behind broad fallback clauses, `rescue`, `catch`, `List.wrap`, `value || []`, or `_ -> nil` when the contract requires a real value.
- Keep controllers, LiveViews, channels, and resolvers thin: business rules belong in contexts/domain modules, while boundary validation and expected user errors remain visible to callers.
- Check supervision and lifecycle for Tasks, GenServers, PubSub, and workers. Verify concurrency, timeouts, stale assigns, reconnects, duplicate delivery, and failure handling where changed.
- Treat logging/audit/prompt/execution metadata construction as production behavior: it should be pure, cheap, correctly shaped, and gated when logging is disabled; it must not silently invoke business logic, external services, or mutation.
- Check changed APIs for callers, unused public surfaces, and local naming/return conventions. Separate introduced defects from pre-existing issues.

## Phoenix / LiveView

- Verify authorization and tenant/account scope before data is fetched, rendered, mutated, subscribed to, or exposed through a route, resolver, controller, LiveView, channel, or URL-driven modal. Hidden UI controls are not authorization.
- Check `mount/3`, `handle_params/3`, and `handle_event/3` independently; direct navigation must not bypass checks. Writes in `mount/3` generally require `connected?(socket)`.
- Keep business logic in contexts; preserve flash/error behavior and valid callback return tuples. Ensure every template assign and component attr/slot is set on every render path.
- For HEEx, rely on escaping. Treat `raw/1`, markdown/HTML conversion, JS HTML insertion, uploads, redirects, and embedded script JSON as security-sensitive and verify sanitization/validation.
- Check LiveView events, JS hooks, PubSub topics, async work, forms, streams, and component boundaries for stale state, unauthorized access, duplicate side effects, and local conventions.

## Data / deploy

- For schemas, changesets, queries, and contexts, verify ownership scope, constraints plus application validation, preload assumptions, transaction boundaries, and that web code does not bypass context/query boundaries.
- For migrations, inspect destructive changes, locks/table rewrites, large backfills, indexes, `NOT NULL` additions, reversibility, and whether the project uses staged or concurrent patterns. Prefer add nullable → dual-read/write → idempotent backfill → enforce/remove in later deploy.
- Check rolling mixed-version compatibility: old/new code and data, routes/events/API shapes, LiveView assets, serialized terms/JSON, webhooks, and queued job args. Ensure removed fields/functions are not still consumed.
- Check feature/capability/permission registration, safe defaults, runtime config and env prerequisites, supervision-tree registration, release tasks, and rollback after partial migration or side effects.
- Workers, schedulers, and external effects need bounded retries, idempotency, compatible args, safe backoff/discard rules, and effects after durable commit. Never run destructive migration or production commands during review.

## Testing

- Match changed behavior to tests, not just changed lines. Require negative authorization/tenant, invalid input, error, concurrency/retry, rollback, and boundary cases when the risk warrants them; tests should assert behavior rather than implementation details.
- Use project-native factories/fixtures, mocks/contracts, async conventions, Oban assertions, LiveView/browser helpers, and wait helpers. Avoid `Process.sleep`; isolate global app env, named processes, ETS, filesystem, and mocks in async tests.
- Check that changed tests actually fail for the old behavior and cover the relevant user/data/deploy contract. Do not demand a test when a project-native check is sufficient, but report a risky unverified path.

## Security

- Trace all user/external input from params, session, sockets, headers, uploads, webhooks, and job args. Scope IDs by actor/account/tenant; never trust ownership, role, permission, or privileged fields from params. Re-check URL-driven and admin paths server-side.
- Changesets must not mass-assign ownership, privilege, audit, entitlement, or verification fields. Use database constraints for race-prone invariants and transactions for atomic multi-step writes.
- Keep HEEx and email output escaped; sanitize rich HTML/markdown. Use placeholders for SQL/fragments, whitelist dynamic fields/order, reject unsafe atom conversion/deserialization/XML, and prevent path traversal.
- Do not expose secrets, tokens, auth headers, private URLs, sensitive structs, or existence information in logs/errors/tests/fixtures. Preserve structured redaction and metadata contracts.
- Verify signed/JWT payloads before trusting claims, use constant-time token/signature comparison, and validate redirect/callback/`return_to` targets against safe routes or relative paths.

## Contracts / maintainability / history

- Compare changed public functions, modules, behaviours, callbacks, routes, params, assigns, component attrs, schemas, specs/types, moduledocs/docs/comments, response shapes, and tests. Update all surfaces together; report mismatched return/arity/error/side-effect contracts.
- Search local siblings before flagging duplication, new helpers, abstractions, options, generated bloat, broad normalization, dead code, wrong visibility, or module-boundary drift. Prefer simple, project-consistent code; block only when complexity hides a real defect or makes the change unreviewable.
- For removed guards/functions/tests, changed query semantics, migrations, suspicious reversals, or unclear legacy constraints, use read-only `git log`, `git show`, and `git blame` on the relevant lines. Use history to classify introduced, reintroduced, intentional, pre-existing, or unknown; do not perform checkout/reset/restore/rebase/merge/commit/push.
- For PR reviews, read human reviews/comments when available, filter bots, and report unresolved actionable requests under human review context. Cross-check relevant memory entries without writing memory.

## Jump overlay routing

Use `jump-elixir-review` only after verifying strong Jump signals or an explicit request. Read nearby current patterns first; do not impose stale conventions. The overlay may check `JumpWeb`/`Jump.Schema`/`Jump.PubSub`, component hierarchy and design tokens, `PhoenixTest`, local wait/factory helpers, `Hammox`, scoped query helpers, and Jump safety wrappers. Report only verified deviations that can affect correctness, security, tests, maintainability, or CI; never block unrelated Elixir projects on Jump preferences.

## Project-native checks

Discover required aliases/scripts before running anything. Prefer the repository's authoritative command (for example `mix jump.ci.lint`, `mix format --check-formatted`, `mix credo`, targeted `mix test`, compile with warnings as errors, or a bounded full suite). Run safe relevant checks in a sensible order; for patch-only PRs mark local checks skipped with the reason. List every relevant command as pass, fail, or skipped, including cwd and missing services/secrets.

## Verdict and evidence

Deduplicate findings and verify each one from source. Return one consolidated review:

```markdown
Reviewed source: <PR via gh diff | checked-out matching PR branch | local diff range>
Verdict: <Approved | Changes requested>

Review lens:
- Assigned lens: <baseline and optional Jump overlay>
- Looked for: <issue classes checked>
- Out of scope: <areas not required by changed files>

Review evidence:
- Source inspected: <patch/files/diff range>
- Instructions/config read: <repo guidance, aliases, CI>
- Local patterns checked: <specific conventions>
- Verified true: <established facts>
- Not verified: <checks skipped and why>

Checks:
- <command with cwd> — pass/fail/skipped and why

Blocking findings:
- [blocking] path/to/file.ex:42 or path:start-end — <verified issue, impact, minimal fix>
- None.

Non-blocking findings:
- [medium|low|info] path/to/file.ex:42 — <advisory, coverage gap, risk, or human request>
- None.

Human review context:
- <unresolved human comments and whether this review agrees, disagrees, or could not verify>

Memory: <consulted or not present>
Residual risks: <meaningful risks not captured above, or none>
```

Every finding needs exact `file:line` or `file:start-end` evidence whenever possible. For unstable or patch-only locations, say `line unknown` and explain why. Do not report suspicions as blockers; verdicts are blocker-focused but verified advisory findings remain visible.

---
name: elixir-deploy-risk-review
description: "Reviews Elixir/Phoenix changes for deployment safety: migrations, backfills, rolling deploy compatibility, feature flags, background jobs, rollback, idempotency, and production configuration."
---

# Elixir Deploy Risk Review

Use this skill when reviewing whether an Elixir/Phoenix change can safely be deployed and rolled back. It is about production rollout risk, not general code quality.

## Review Contract

Answer: **Can this ship through a normal deploy without outage, data loss, stuck jobs, broken rollback, or missing production prerequisites?**

Block only concrete deployment hazards. Prefer observations for risks that are acknowledged, mitigated, or require unusual conditions.

## Evidence Rules

1. Read the diff, changed migrations, config, workers, supervisors, release tasks, seeds, and PR/deploy notes when available.
2. Compare new deployment assumptions against existing project patterns.
3. Check both forward deploy and rollback behavior, including mixed-version windows during rolling deploys.
4. Verify whether prerequisites are documented and actionable. Do not assume a backfill, flag, queue, env var, or registry entry exists without reading it.
5. Do not run destructive commands. Git inspection, grep, targeted tests, and local config reads are safe.

## Scope Triggers

| Change touches | Review for |
| --- | --- |
| `priv/repo/migrations/**` | Locking, data loss, rollback, backfills |
| Schemas/queries expecting new columns | migration/code ordering |
| Feature flags, entitlements, capabilities, permissions | registration and mixed behavior |
| Oban/workers/tasks/schedulers | retries, idempotency, args compatibility |
| Supervisors/GenServers/registries | startup and registration |
| Config/runtime env/secrets | production prerequisites |
| APIs/events/webhooks | backward/forward compatibility |
| Serialization, atoms, structs | in-flight job/data compatibility |

## Migrations and Backfills

Check migrations for:

- Destructive operations: dropping tables/columns, renaming columns, changing column types, deleting data, or rewriting large tables.
- Adding `NOT NULL` columns without a safe default or staged backfill.
- Adding indexes on large tables without concurrent/index-safe project conventions.
- Long transactions, `execute` blocks, table rewrites, lock-heavy constraints, and data migrations inside schema migrations.
- Code that assumes a column exists before all nodes have migrated, or old code that breaks after migration if rolled back.
- Reversible migrations: if `down/0` cannot restore data, the deploy plan should say so.

Prefer staged patterns for risky DB changes:

1. Add nullable column/index/constraint safely.
2. Deploy code that writes both old and new shapes when needed.
3. Backfill idempotently and monitor.
4. Enforce `NOT NULL`/remove old path in a later deploy.

## Rolling Deploy Compatibility

During a rolling deploy, old and new code can run simultaneously. Check:

- New code can read old data and old code can tolerate new data.
- Removed functions, modules, routes, events, or PubSub message shapes are not still used by old nodes, clients, jobs, or external services.
- Changed API response/request shapes preserve backward compatibility or are versioned/gated.
- LiveView events and JS hooks remain compatible across asset/code deploy timing.
- Serialized terms, JSON payloads, webhook events, and Oban args tolerate both old and new fields.
- `String.to_existing_atom/1` is not used on values that may be introduced by data before code has loaded the atom on every node.

## Feature Flags, Capabilities, and Registration

Check for production registration gaps:

- New feature flags, capabilities, entitlements, permissions, plans, or roles are registered in the project’s canonical registry/config.
- Default behavior is safe when the flag/capability is absent or disabled.
- Mixed flag states do not produce partial writes or unreadable data.
- Capability names match exactly across checks, seeds, config, tests, and UI.
- Deploy notes explain rollout order when a flag must be enabled after code or data deploy.

## Background Jobs and Processes

Check workers, scheduled jobs, tasks, consumers, and supervisors:

- New Oban/job modules are registered where the project requires registration.
- Job args remain backward compatible for queued in-flight jobs.
- Workers are idempotent: retries should not duplicate emails, charges, webhooks, records, or irreversible side effects.
- External side effects happen after durable state commits and have retry-safe deduplication where needed.
- Timeouts, backoff, queues, priorities, uniqueness, and discard rules match risk.
- New GenServers/Supervisors/Registries are added to supervision trees and have safe startup dependencies.
- Release tasks/backfills can resume after interruption.

## Rollback and Recovery

Ask what happens if the deploy is reverted after migrations or partial side effects:

- Will old code run against the migrated schema?
- Are dropped/renamed columns still referenced by old code?
- Can a partially completed backfill be re-run safely?
- Are generated files, emails, webhooks, or queue entries duplicated or orphaned?
- Does rollback require manual cleanup, draining queues, disabling flags, or restoring config?

Block when rollback would predictably crash production or lose data and the PR provides no mitigation.

## Environment and Runtime Configuration

Check for new production dependencies:

- New `System.fetch_env!/1`, `System.get_env/1`, `Application.fetch_env!/2`, config keys, secrets, endpoints, buckets, queues, cron entries, or permissions.
- Missing defaults for dev/test/runtime or release config.
- New dependency on an external service without timeout, retry, and failure behavior.
- Runtime config read at compile time, especially in releases.
- Secret values or production identifiers accidentally committed.

## Tests and Checks

Prefer targeted validation:

- `mix test` for changed deploy-sensitive code or migration tests if present.
- `mix compile --warnings-as-errors` for removed/renamed functions.
- `mix ecto.migrate` only in safe local/test DB contexts and only when appropriate; never against real environments.
- Search for references to removed functions/modules/fields.

If a check requires DB services, secrets, or long-running infrastructure, skip and state why.

## Output Guidance

Report deployment risks as:

- `[blocking]` for likely production crash, outage, data loss, broken migration/rollback, missing required registration, or non-idempotent job/side effect that can fire in normal deploy conditions.
- `[observation]` for deploy notes, monitoring, or sequencing improvements that reduce risk but do not block merge.

Each finding should include: file/line, failure scenario, when it occurs (migration, rolling deploy, after deploy, rollback, job retry), and the minimal mitigation.

---
name: elixir-ecto-review
description: Reviews Ecto schemas, changesets, contexts, queries, transactions, migrations, and web-layer data access for safety and correctness.
---

# Elixir Ecto Review

Use this skill for Ecto schemas, migrations, contexts, query modules, repo calls, data migrations, and web/API code that reads or writes database records.

## First: Discover Local Patterns

Before critiquing, inspect nearby schemas, contexts, and migrations for project conventions:

- Schema macros and ID conventions.
- Changeset naming and validation style.
- Context API boundaries.
- Migration safety practices.
- Repo wrappers, read-replica helpers, telemetry options, and tenancy/scoping helpers.

Apply local conventions unless they are unsafe.

## Changesets and Constraints

Check:

- Inserts/updates go through named changeset functions when validations or casts are required.
- `cast/3` whitelists external fields; trusted internal changes are explicit.
- Required fields have `validate_required/3` unless they are filled by the database or a controlled context.
- App validations are paired with database constraints where races are possible.
- Unique indexes have matching `unique_constraint/3` on write paths.
- Foreign keys have matching `foreign_key_constraint/3` where deletes/inserts can race.
- Check/exclusion constraints are represented with `check_constraint/3` or equivalent error handling.
- Changesets do not silently discard important errors or replace specific errors with generic ones.

## Queries and N+1s

Check:

- List views preload associations that templates, serializers, or loops access.
- No `Enum.map`/comprehension performs per-row `Repo.get`, `Repo.preload`, aggregate query, or authorization query without batching.
- Joins, subqueries, and preload choices match the access pattern.
- Query filters preserve tenant/account/authorization scope.
- Pagination and limits exist for unbounded user-facing lists.
- Dynamic query fragments are parameterized, not string-interpolated.

## Transactions and Ecto.Multi

Check:

- Two or more related writes use `Ecto.Multi` or an equivalent transaction when partial success would corrupt state.
- External side effects are not executed inside a transaction unless the project intentionally does so and retries are safe.
- Background jobs, emails, and webhooks are enqueued/emitted after durable state commits or through a transactional outbox pattern.
- Multi step names are meaningful enough to diagnose failures.
- Rollbacks preserve useful error information.

## Migration Safety

Check:

- Adding `NOT NULL` columns to existing tables is done safely: default/backfill/validate/enforce in deployable steps.
- Indexes for large tables use the project's concurrent-index pattern when needed.
- Renames/drops are safe for rolling deploys and old code paths.
- Backfills are bounded, resumable, or moved to tasks/jobs when too large for a migration.
- New foreign keys, unique indexes, and check constraints match application behavior.
- Migrations are reversible when the project expects rollback support, or explicitly irreversible when appropriate.

## Web-Layer Repo Access

Check:

- LiveViews, controllers, channels, resolvers, and components do not call `Repo.*` directly when the project uses context boundaries.
- Authorization and tenant scoping happen in context/query functions, not only in the UI.
- Web params are cast/validated before reaching Ecto queries.
- Context functions expose intention-revealing APIs instead of leaking query composition to callers.

## Schema and Data Modeling

Check:

- Associations, `on_delete`, and `on_replace` semantics match real lifecycle rules.
- Defaults are placed in the database when needed for consistency across writers.
- Enum values, embedded schemas, and virtual fields are validated at boundaries.
- Timestamps and optimistic locks are used where local conventions require them.

## Output

Report verified blockers with the specific race, data corruption path, N+1 path, unsafe migration scenario, or boundary violation. Mention non-blocking convention observations only when they materially help the developer.

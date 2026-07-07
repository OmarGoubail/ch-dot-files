---
name: elixir-code-contracts-review
description: "Reviews Elixir/Phoenix changes against code-defined contracts: moduledocs, specs, comments, public APIs, behavior callbacks, routes, params, and test assertions."
---

# Elixir Code Contracts Review

Use this skill when a change may violate or require updates to contracts already expressed in the code: `@moduledoc`, `@doc`, `@spec`, `@type`, comments, callbacks, routes, params, schemas, tests, and public API behavior.

## Review Contract

Ask: **Does the changed code still honor the contracts the codebase documents or implies?**

A contract mismatch is worth reporting when it can mislead callers, break integrations, hide behavior changes, or make tests assert the wrong thing. Do not nitpick wording unless it is materially wrong.

## Evidence Rules

1. Read the full changed file and nearby docs/comments before judging.
2. Read callers and tests when a public function, route, callback, event, or return shape changes.
3. Treat code, docs, specs, tests, and route definitions as evidence; do not assume the docs are correct if the PR intentionally updates behavior.
4. If the PR changes a contract intentionally, verify all contract surfaces are updated together.
5. Report the exact contract text or code shape that conflicts with the implementation.

## Scope Triggers

| Change touches | Review contracts in |
| --- | --- |
| Public `def`, context APIs, clients | `@doc`, `@spec`, callers, tests |
| Public specs use broad shapes such as `term()` | whether docs/specs match expected maps, structs, keywords, lists, or `nil` |
| Logging or persisted metadata builders | documented/spec'd metadata shape and downstream queryability |
| Module purpose or behavior | `@moduledoc`, module comments |
| Behaviour implementations | `@callback`, `@impl`, return shapes |
| Controllers/LiveViews/routes | path params, assigns, events, response contracts |
| Schemas/changesets | required fields, validations, types |
| Tests | assertions match documented behavior |
| Comments near modified code | TODO/NOTE/WARNING invariants |

## Contract Sources

Look for these in modified files and immediate dependencies:

- `@moduledoc`: module purpose, invariants, usage guidance, examples.
- `@doc`: parameter expectations, return values, errors, side effects, examples.
- `@spec`, `@type`, `@opaque`: types accepted/returned by public functions.
- `@callback` and `@impl true`: behavior contracts and callback semantics.
- Inline comments: `TODO`, `FIXME`, `NOTE`, `WARNING`, `IMPORTANT`, `HACK`, and imperative guidance such as "must", "always", or "never".
- Router definitions, verified routes, controller action names, LiveView params/actions/events, component attributes/slots.
- Tests and fixtures: they often encode intended behavior even when docs are sparse.
- Config/schema metadata: required keys, enum values, feature/capability names.

## Public API Contracts

For changed public functions:

- Does the implementation still return documented shapes such as `{:ok, value}`, `{:error, reason}`, `nil`, struct, list, stream, or raised exception?
- Are errors still surfaced at the documented boundary?
- Do examples in docs still compile conceptually and match current arity/options?
- Are optional keyword arguments documented and honored?
- If a function now has side effects, authorization requirements, or transaction behavior, are callers and docs updated?
- If a return type narrowed or broadened, are downstream pattern matches safe?

Prefer fixing either code or contract, depending on which changed intentionally. The finding should say which side is stale.

## Specs and Types

Review `@spec` and types for practical mismatches:

- New `nil` returns, error tuples, exceptions, or alternate structs not represented in the spec.
- Specs claiming a broad type while implementation only handles a narrow shape, or vice versa.
- Changed map keys, struct fields, enum atoms, keyword options, or list element types.
- Public functions missing specs only when the project consistently requires specs or the API is complex enough that callers need one.
- Public specs using `term()` or similarly broad aliases when docs/callers require a specific map, struct, keyword list, list element shape, or meaningful `nil`.
- Specs that broaden accepted input beyond what the implementation, docs, or downstream callers can safely handle.

Do not block solely because Dialyzer might infer a more precise type. Focus on mismatches that can mislead humans or break callers.

## Logging and Metadata Contracts

When a change builds logging, audit, event, prompt/execution, or persisted metadata payloads, verify the shape contract end to end:

- Persisted metadata documented or tested as structured data should remain a map/list shape with queryable fields, not an inspected string or lossy text blob.
- Metadata builders should not accept arbitrary `term()` or silently normalize unexpected shapes beyond their docs/specs unless they sit at a trusted boundary and preserve failure information.
- Redaction/sanitization helpers should preserve safe structure while removing sensitive keys, so downstream JSON/map-column queries and consumers still work.
- If a metadata field intentionally changes shape, update specs, docs, tests, and readers together.

## Behavior and Callback Contracts

For behaviours, protocols, GenServer callbacks, Phoenix callbacks, and adapters:

- `@impl true` functions must match the expected callback arity and return shape.
- Behaviour docs and callback specs should match every implementation touched by the change.
- New callbacks need all required implementations or safe defaults.
- GenServer, Task, Supervisor, Phoenix controller, LiveView, and Plug callbacks must return valid tuples/conn/socket values.
- Do not require `@impl` where the project does not use it consistently, but flag incorrect callback shapes.

## Routes, Params, and Boundary Contracts

For web boundary changes:

- Router path params, controller action params, LiveView `handle_params/3`, `handle_event/3`, and component attrs should agree on names and required values.
- Verified route calls (`~p`) should match route definitions and params.
- JSON/API response shapes should preserve documented or tested fields unless the contract is intentionally versioned/updated.
- LiveView assigns used in templates must be assigned for every render path.
- Component `attr`/`slot` declarations should match how the component is called and rendered.
- Form params and changeset fields should agree on nested names and expected types.

## Comments and Local Invariants

Read comments around modified code. Flag changes that contradict explicit constraints:

- "Must run after X" but order changed.
- "Do not call during mount" but new call does so.
- "Assumes preloaded association" but caller no longer preloads it.
- `TODO`/`FIXME` says a case is unsupported and PR now relies on it.
- Comment describes a security, concurrency, or deploy invariant that the new code bypasses.

If the code is now correct and the comment is stale, report the stale comment only when it will mislead future maintainers.

## Tests as Contracts

Tests should match documented/public behavior:

- Assertions should verify the behavior the docs/API promise, not just implementation details.
- If code behavior changes intentionally, tests and docs should be updated together.
- If tests document an edge case, new code should preserve it or explicitly change it.
- Avoid requiring tests for every doc change; focus on risky or subtle contracts.

## Output Guidance

Report findings with:

- File/line for the changed code.
- Contract source and exact quote or signature when possible.
- What the new code does differently.
- Why the mismatch matters to callers, tests, users, or maintainers.
- Minimal fix: update code, docs, spec, route/params, or tests.

Use `[blocking]` for contract mismatches that break callers, callbacks, routes, response shapes, or tests. Use `[observation]` for stale or incomplete docs that do not affect shipping.

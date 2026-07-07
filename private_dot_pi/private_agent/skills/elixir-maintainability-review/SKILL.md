---
name: elixir-maintainability-review
description: Reviews Elixir/Phoenix changes for maintainability risks such as duplication, over-abstraction, LLM bloat, local inconsistency, dead code, and needless complexity.
---

# Elixir Maintainability Review

Use this skill when reviewing complexity, duplication, readability, long-term health, LLM-generated bloat, or whether a change follows local Elixir/Phoenix patterns.

## Review Contract

Ask: **Does this change add avoidable complexity that will materially slow future work or hide defects?**

Most maintainability findings are non-blocking observations. Block only when the complexity materially endangers the change: duplicated business logic that will diverge immediately, dead public APIs used by no one but claimed as integration points, over-abstraction that breaks behavior, or generated bloat that makes the implementation unreviewable.

## Evidence Rules

1. Read full changed files, not only the diff, before judging structure.
2. Search for existing local implementations before calling something duplicate.
3. Prefer project consistency over generic taste. If local code has an established pattern, use that as the standard.
4. Do not ask for refactors unrelated to the reviewed change.
5. Label severity honestly: most notes should be `[observation]`, not blockers.

## Scope Triggers

| Change introduces | Review for |
| --- | --- |
| New helpers/utils | duplicate existing helpers |
| New modules/behaviours/protocols | premature abstraction |
| Large additions to contexts/LiveViews | module bloat and misplaced logic |
| New public functions | wrong visibility or unused APIs |
| Verbose defensive code | LLM bloat and hidden invariants |
| Defensive normalization in core business/prompt/execution paths | strict contracts hidden by broad fallbacks |
| Generic options/config | unnecessary flexibility |
| Repeated query/business logic | divergence risk |

## Local Pattern Discovery

Before critiquing:

- Search for sibling modules that solve the same problem.
- Inspect contexts, schemas, components, test support, factories, and utilities used nearby.
- Prefer existing helper names, return shapes, option styles, and error handling conventions.
- Check whether a project has canonical utility modules before accepting a new helper.
- In Phoenix apps, compare similar controllers/LiveViews/components before recommending a new architecture.

Useful commands:

```bash
grep -R "def .*similar" lib test --include='*.ex' --include='*.exs'
grep -R "module_or_function_name" lib test --include='*.ex' --include='*.exs' --include='*.heex'
wc -l path/to/file.ex
```

## Duplication

Flag new code that reimplements existing behavior when divergence would matter:

- Context functions that duplicate an existing query or command with a slightly different name.
- Local helpers duplicating shared utility functions for blank checks, id extraction, map/list transformations, date/time formatting, result unwrapping, or query sanitization.
- Copied LiveView/controller/component logic where a shared component or helper already exists.
- Test setup duplicating factories/fixtures that encode project invariants.
- Repeated business rules in multiple layers instead of one context/domain function.

Do not flag tiny duplication when extracting it would make code harder to read.

## Premature Abstraction and Over-Engineering

Be skeptical of abstractions created for one use case:

- Behaviour/protocol with a single implementation.
- Strategy/adapter/processor modules where only one strategy exists.
- Options maps or config knobs whose values never vary.
- Generic builders/DSLs for straightforward data construction.
- Wrapper modules that simply call one function once.
- Deep function chains carrying an option only to use it in one leaf function.

The test: if inlining the abstraction at its only call site makes the code smaller and clearer without losing a real extension point, it is probably premature.

## LLM Bloat

AI-generated code often works but adds noise. Look for:

- Comments that restate obvious code rather than explain constraints.
- Redundant variable assignments immediately returned or passed once.
- Defensive `nil`/error branches that cannot occur given the caller contract.
- Large `with` or `case` chains where a simple pattern match would express the invariant.
- Generic names like `processor`, `manager`, `handler`, or `data` hiding domain meaning.
- Excessive docs/specs on private helpers while public behavior is undocumented.
- Broad helpers introduced to avoid three lines of local code.

Do not block on bloat unless it obscures correctness, security, or deploy safety.

## Strict Core Contracts and Defensive Normalization

Elixir code should usually normalize untrusted input at boundaries, then keep core business, prompt, execution, and persistence-preparation paths strict about the shapes they claim to accept. Flag broad defensive fallbacks such as `List.wrap/1`, `value || []`, catch-all clauses, `_ -> nil`, `rescue _`, or broad `try/rescue` when the function contract expects a map, struct, keyword list, list, or `nil` with specific meaning.

Treat these as `[observation]` when they merely make invariants harder to see. Treat them as `[blocking]` when they can hide correctness, security, deploy, or data-integrity failures; swallow exceptions from prompt/execution/business logic; turn malformed input into empty work; or make production behavior silently diverge from docs/specs/tests. Prefer explicit pattern matches, guards, narrow clauses, boundary validation, or named error returns that preserve the real failure.

For logging, audit, prompt, or execution metadata, review the work needed to build the payload, not only the final log write. Payload construction should be pure, cheap, and skipped or gated when logging is disabled; if a metadata builder calls business logic, prompt resolution, translation, database work, external services, or template/model lookup, treat it as production behavior rather than harmless logging.

## Helper Reuse Boundaries

Reuse generic helpers for genuinely generic transformations, such as key conversion or bounded string operations. Keep domain-specific logging policy, redaction policy, prompt metadata shape, and truncation semantics local until multiple callers need the exact same policy. Reject helper reuse that turns structured data into human-readable text, hides domain invariants inside broad utility functions, or spreads one log surface's policy across unrelated code.

## Module Boundaries

Check whether new code belongs where it was added:

- Controllers, LiveViews, and components should stay thin; business logic usually belongs in contexts/domain modules.
- Context modules should not become dumping grounds for unrelated public functions.
- Schema modules should focus on data shape/changesets; avoid UI or transport concerns.
- Tests should assert behavior, not mirror implementation internals.
- Large modules that cross local size norms after the change may deserve a split, but treat this as an observation unless it blocks review.

Signals worth noting:

- A file grows beyond local norms, especially from several unrelated responsibilities.
- A LiveView gains many event handlers that could be a component or domain function.
- A public context API is named after one caller's UI instead of the domain operation.

## Dead Code and API Visibility

For each new public function/module:

- Search for callers in `lib`, `test`, templates, configs, and routes.
- If only used inside the same module, consider `defp` unless it is a callback, test seam, macro API, documented extension point, or intentionally public context function.
- Remove unused private helpers, imports, aliases, assigns, test helpers, and config.
- Do not require private visibility for Phoenix/OTP callbacks, `@impl` functions, behaviours, or functions intentionally called dynamically.

## Compile-Time Coupling

Elixir module attributes execute at compile time. Flag new compile-time dependencies when they are avoidable:

- `@attr ProjectModule.function()` used as runtime data can create compile-connected dependencies.
- Prefer calling the function at runtime unless the value is needed for guards, macros, attributes consumed at compile time, or constants from stdlib/dependencies.
- Use project xref checks when available if the repo enforces compile-connected limits.

## Tests and Documentation Fit

Maintainability includes tests that future developers can understand:

- Tests should use established factories/fixtures and meaningful assertions.
- Avoid over-specified tests that freeze incidental implementation details.
- Public APIs should have enough docs/specs to communicate non-obvious contracts, but not noisy docs for every tiny private helper.

## Output Guidance

Report only findings that are actionable and tied to changed code:

- `[blocking]` only when maintainability creates a real correctness/reviewability hazard for this change.
- `[observation]` for duplication, bloat, visibility, or abstraction issues worth addressing but not required to ship.

Each finding should include the existing pattern or search evidence that supports it and a concrete simpler alternative.

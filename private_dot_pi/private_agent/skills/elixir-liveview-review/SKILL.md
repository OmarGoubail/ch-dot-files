---
name: elixir-liveview-review
description: Reviews Phoenix LiveView, LiveComponent, HEEx, and component changes for lifecycle safety, assign discipline, local component conventions, and test style.
---

# Elixir LiveView Review

Use this skill for Phoenix LiveView modules, LiveComponents, HEEx templates, functional components, upload flows, JS commands, and LiveView tests.

## First: Discover Local Patterns

Before critiquing LiveView code, inspect the repository's existing conventions. Do not assume Jump-specific rules apply everywhere.

Required searches/read checks:

- Search for `attach_hook` usage and how hooks are named, registered, and removed.
- Search for existing functional components and their `attr`, `slot`, assigns, and naming style.
- Search component modules such as `*_components.ex`, `components/**`, `core_components.ex`, and design-system modules.
- Search similar LiveViews/LiveComponents that implement the same workflow, authorization, forms, uploads, streams, or async loading.
- Determine whether tests prefer `PhoenixTest` over raw `Phoenix.LiveViewTest` by inspecting `mix.exs`, `test/support`, and nearby LiveView tests.

Only flag deviations that matter for correctness, maintainability, or project consistency.

## Lifecycle and Assigns

Check for blockers:

- Every assign read in render/HEEx is initialized before first render, including loading/error states.
- `mount/3`, `handle_params/3`, `handle_event/3`, `handle_info/2`, and async callbacks return valid socket tuples.
- Side effects such as PubSub subscriptions, timers, presence tracking, and hooks are gated with `connected?(socket)` when appropriate.
- `attach_hook` callbacks return the required continuation tuples and do not accidentally halt unrelated lifecycle behavior.
- URL params are validated in `handle_params/3`; invalid params produce a safe redirect, patch, or error state.
- Temporary assigns and streams are used only when the template/event flow supports them.

## Async and Loading State

Default to the project's existing style, then check:

- Slow mount work, multiple DB queries, preloads, or external calls should consider `start_async`, `assign_async`, or a staged loading state.
- Data required for authorization or whether the page can render may remain synchronous.
- Avoid nested or competing async results that create impossible template states.
- Async callbacks handle success and failure explicitly and do not leave stale loading state.
- Do not introduce races between async results, params, selected rows, or user events.

Ask rather than dictate when the tradeoff is ambiguous.

## Components and HEEx

Check:

- Functional components declare expected `attr`/`slot` metadata where that is the local convention.
- Callers pass explicit assigns instead of broad `{assigns}` spreading unless nearby components do so intentionally.
- Component APIs are stable and avoid leaking parent LiveView internals.
- Similar existing components are reused instead of duplicating UI behavior.
- HEEx uses valid syntax, stable IDs for dynamic content, and predictable `phx-*` targets.
- Lists use streams or keyed comprehensions where reorder/delete behavior matters.
- JS commands and DOM patches do not fight each other.
- Raw HTML, unsafe URLs, and user-provided content are escaped or sanitized.

## Forms and Events

Check:

- Forms have stable IDs and project-standard `phx-change`/`phx-submit` patterns.
- Changesets or form data are assigned consistently after validation and save failures.
- `handle_event` clauses pattern match event names and params intentionally.
- Expected user errors become form errors, flashes, or assigns; unexpected invariants may crash.
- Business rules remain in contexts or components designed for them, not buried in event handlers.

## Uploads

Check:

- Upload size, count, and type are validated server-side.
- Filenames/paths are generated safely and do not trust user filenames.
- Consumed entries and cleanup are handled on success/failure.
- Auto-upload is compatible with the form flow and does not race submit handling.

## Testing Lens

When tests are in scope, combine with `elixir-testing-review`:

- Use the locally preferred LiveView testing library (`PhoenixTest` if the repo prefers it).
- Assert user-visible behavior instead of LiveView internals where possible.
- Avoid `Process.sleep`; use available wait/assert helpers.
- Cover validation errors, navigation/patch behavior, async states, and authorization boundaries when touched.

## Output

Report only verified findings that can block shipping. Include the local pattern used as evidence when flagging convention deviations.

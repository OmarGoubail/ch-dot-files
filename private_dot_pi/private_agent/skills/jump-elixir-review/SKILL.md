---
name: jump-elixir-review
description: Reviews Jump-specific Elixir/Phoenix conventions such as JumpWeb LiveView usage, Jump.Schema, PhoenixTest, Hammox, component hierarchy, helper APIs, and internal safety patterns. Use only in Jump repositories or when the user explicitly asks for Jump standards.
---

# Jump Elixir Review

Use this skill only when the repository is a Jump codebase or the user explicitly asks for Jump-style review. This skill is intentionally project/company-specific; do not apply these rules to unrelated Elixir projects.

## Applicability

Before using this skill, verify at least one strong signal:

- Existing modules use `JumpWeb`, `Jump.Schema`, `Jump.PubSub`, or `Jump.Guardian`.
- `mix.exs`, app modules, or config clearly identify a Jump application.
- Project instructions mention Jump conventions.
- The user explicitly says to review with Jump standards.

If no signal exists, skip this skill and use the generic Elixir skills instead.

## Local Pattern Discovery First

Even inside Jump repos, read nearby code before flagging. Search for:

```bash
rg "use JumpWeb|Jump\.Schema|Jump\.PubSub|ok\(\)|noreply\(\)|PhoenixTest|Hammox|example_data\(|await_has|await_gone|attach_hook"
```

Use current local patterns as evidence. Do not enforce stale conventions if the repository has clearly migrated.

## LiveView and Phoenix

Check Jump-specific LiveView conventions:

- LiveViews use `use JumpWeb, :live_view`, not `use Phoenix.LiveView` directly.
- PubSub uses `Jump.PubSub`, not raw `Phoenix.PubSub`, unless the local module has a reason.
- LiveView callbacks use named `@impl Phoenix.LiveView`, not `@impl true`, where Credo/project convention expects it.
- Return helpers such as `ok()` and `noreply()` are used when that is the local Jump convention.
- Existing `attach_hook` patterns are reused for cross-cutting LiveView behavior such as auth, tenant/account setup, params, or instrumentation.
- Forms follow Jump conventions such as stable `id` and `phx-change` with `phx-submit` when enforced locally.
- LiveView code keeps business logic in contexts/domain modules rather than event handlers.

## Components and Design System

Check that new UI follows existing Jump component conventions:

- Reuse existing functional components before creating new UI primitives.
- Search component modules and similar screens before accepting duplicate components.
- Respect the local component hierarchy, including core/design-system/project/page-specific layers where present.
- Functional components declare `attr`/`slot` metadata when local components do.
- Avoid broad `{assigns}` spreading unless the nearby component API intentionally uses it.
- Avoid raw `<button>`, `<svg>`, raw color classes, hex colors, or unsupported font weights when Jump design tokens/core components exist.
- Core components include required design/Figma documentation when that is an established convention.

## Schemas, Ecto, and Contexts

Check Jump data conventions when present:

- Schemas use `Jump.Schema` or the local Jump schema macro instead of raw `Ecto.Schema` when expected.
- ID/UXID conventions are preserved, including prefixed IDs if the project uses them.
- Context APIs remain intention-revealing and own Repo/query details.
- Web layers do not call `Repo.*` directly when Jump context boundaries exist.
- Changesets pair app validations with database constraints where races are possible.
- Multi-step writes use `Ecto.Multi` or local transaction helpers when partial success would corrupt state.
- Existing scoped query/mutation helpers are used for tenant/account/authorization boundaries.

## Tests

Check Jump test conventions:

- Prefer `PhoenixTest` for user-facing LiveView/browser-like flows when nearby tests use it.
- Avoid raw `Phoenix.LiveViewTest` for new flows unless it is clearly the local convention or needed for a low-level assertion.
- Use Jump/local wait helpers such as `await_has`, `await_gone`, `eventually`, or equivalent instead of `Process.sleep`.
- Prefer local factory/fixture style, including `example_data/0` if that is the project pattern.
- Use `Hammox` instead of `Mox` when the repo standardizes on Hammox contracts.
- Use local Oban/job assertion helpers when background jobs are in scope.
- Async tests must not mutate global app env, named processes, ETS, filesystem paths, or mocks without isolation/cleanup.

## Security and Safety Helpers

Check Jump-specific safety patterns when relevant:

- Authorization and tenant/account scoping use the local permission/scoped-query helpers rather than ad hoc UI-only checks.
- LiveView `handle_params` and URL-addressable modals re-check authorization before loading scoped records.
- XSS-sensitive rendering uses established helpers for safe HTML/text conversion; raw HTML requires clear sanitization.
- Token/JWT handling uses approved helpers; do not decode or peek tokens ad hoc when Jump helpers exist.
- XML/file/upload paths use local safe parsing/storage helpers when available.

## Idiom Preferences

Apply only when consistent with the repo:

- Avoid defensive `try/rescue` for normal control flow.
- Let unexpected invariant failures surface rather than hiding them behind `nil` or generic fallbacks.
- Use expected `{:ok, _}` / `{:error, _}` returns, pattern matching, `case`, and `with` at real boundaries.
- Do not add broad fallback clauses that hide impossible states.

## Output

Report Jump-specific findings only when:

- The convention is verified in this repo or current project instructions.
- The deviation can cause bugs, security issues, test flakiness, maintenance drift, or failed CI/Credo.
- You can cite the changed file and the local pattern/evidence.

Format findings as concise blockers or high-signal observations. Do not block unrelated projects on Jump-only preferences.

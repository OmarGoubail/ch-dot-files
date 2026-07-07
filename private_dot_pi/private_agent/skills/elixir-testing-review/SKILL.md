---
name: elixir-testing-review
description: Reviews Elixir and Phoenix tests for project-preferred test APIs, async safety, reliable waiting, fixtures/factories, mocks, and background job assertions.
---

# Elixir Testing Review

Use this skill for `*_test.exs`, `test/support/**`, factories, fixtures, mocks, ExUnit setup, LiveView tests, Oban tests, and test helper changes.

## First: Discover Local Test Patterns

Before critiquing tests, inspect nearby tests and support files:

- Determine whether LiveView tests prefer `PhoenixTest` over raw `Phoenix.LiveViewTest`.
- Identify factory or fixture style: ExMachina, custom factories, fixtures, `example_data/0`, seeds, or builders.
- Check whether `Hammox`, `Mox`, Bypass, Mimic, or no mocks are used.
- Check whether Oban test helpers are present.
- Check async defaults in `DataCase`, `ConnCase`, `FeatureCase`, and related case templates.

Prefer local patterns unless they make tests flaky or unsafe.

## Async Safety

Check:

- `async: true` tests do not mutate global process/application state without isolation.
- `Application.put_env`, logger config, persistent term, ETS, named processes, filesystem paths, and global mocks are isolated or use `async: false` with explanation.
- Sandbox ownership is correct for spawned processes, LiveViews, Tasks, channels, Oban jobs, and async callbacks.
- Tests do not depend on execution order or shared database rows.
- Cleanup happens in `on_exit` when global state is changed.

## Reliable Waiting

Check:

- No `Process.sleep` for synchronization. Use project helpers such as `await_has`, `await_gone`, `eventually`, `assert_receive`, `refute_receive`, Oban helpers, or supervised process signals.
- Timeouts are bounded and meaningful.
- Async LiveView or job assertions wait for the user-visible or durable effect, not an implementation detail.

## Phoenix and LiveView Tests

Check:

- Explicitly inspect changed LiveView test files for raw LiveViewTest usage:
  - `Phoenix.LiveViewTest`
  - `live(` / `live/2`
  - `render_click`
  - `render_submit`
  - `element(` when the local project prefers PhoenixTest helpers
- If the repo prefers `PhoenixTest`, new LiveView tests use it rather than raw `Phoenix.LiveViewTest` unless there is a clear reason.
- Tests assert visible behavior, navigation, validation errors, patches, uploads, and permissions rather than private assigns where possible.
- Selectors are stable and user-oriented; brittle CSS chains are avoided.
- Tests cover both success and important failure/authorization paths touched by the PR.

## Factories and Fixtures

Check:

- Test data uses the local factory/fixture convention.
- Factories specify only fields relevant to the scenario and avoid duplicating defaults.
- Required associations are explicit enough to make the scenario understandable.
- Generated unique values avoid collisions under async runs.
- Fixtures do not hide critical setup or authorization context.

## Mocks and External Boundaries

Check:

- If `Hammox` is present/preferred, mocks use it consistently and verify contracts.
- Mock expectations are verified on exit when the library requires it.
- No broad mocks hide the behavior under test.
- External HTTP/email/storage calls are stubbed at the boundary used by the project.
- Tests do not make network calls or depend on real external services.

## Oban and Background Jobs

If Oban helpers are present, check:

- Use `assert_enqueued`, `refute_enqueued`, `all_enqueued`, or project wrappers instead of raw Repo queries when that is the local convention.
- Job args, queue, worker, scheduled time, and uniqueness are asserted when behavior depends on them.
- Job execution tests drain/perform jobs through helper APIs and account for retries/idempotency.

## Coverage and Regression Value

Treat missing tests as blocking or at least first-class actionable review findings when the PR changes risky behavior:

- Authorization or tenant scoping.
- Data migrations or multi-step writes.
- LiveView forms, async state, uploads, or navigation.
- Background jobs, external side effects, billing, notifications.
- A bug fix where the bug can regress.
- New mutation handlers such as add/edit/delete/reorder where persistence or ordering matters.
- Any coverage gap explicitly requested by a human reviewer.

If a human reviewer requested coverage, do not bury it as a residual risk. Surface it in the review as a human-requested coverage gap and state whether you agree.

## Output

Report all verified test findings, split by severity:

- Blocking: flakiness, async unsafety, missing high-value coverage for risky behavior, wrong test API that undermines the test, or assertions that do not prove required behavior.
- Non-blocking: useful coverage gaps, human-requested tests, weak assertions, local convention drift, or low-risk missing paths.

Do not hide non-blocking test concerns as residual risk; list them in `Non-blocking findings` so the user can decide whether to address them.

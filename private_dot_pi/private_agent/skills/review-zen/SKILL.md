---
name: review-zen
description: Create and open a Review Zen TUI for a diff, branch, commit, or pull request. Use it to explain important code, runtime behavior, happy paths, failure paths, and test evidence.
---

# Review Zen

Create one Review Zen bundle. A bundle is one JSON file that contains the complete review.

Use ASD-STE100 Simplified Technical English.

- Use short sentences.
- Give one instruction in each sentence.
- Use the active voice.
- Use one term for one meaning.
- Define an unfamiliar term before you use it.

## Workflow

1. Find the exact diff, branch, commit, or pull request.
2. Read the changed source and its callers.
3. Read the related tests and contracts.
4. Read `~/.local/share/review-zen/FORMAT.md`.
5. Make a list of Review Stops in execution order.
6. Create one JSON object that follows the bundle format.
7. Write the object to `/tmp/review-zen/<repo>-<change>.json`.
8. Use a lowercase file name with safe characters.
9. Validate the file with `review-zen --check <file>`.
10. Correct each validation error.
11. Open the bundle with the applicable method below.

The bundle is complete when these conditions are true:

- Each important changed behavior has a Review Stop.
- Each important failure has a Review Stop.
- Each Focus Block has a Language explanation.
- Each Focus Block has an Intent explanation.
- Each evidence claim refers to an inspected test.
- `review-zen --check` succeeds.

## Review structure

A Review Stop explains one behavior in one scenario.

A Focus Block contains the smallest source ranges that the user must read together.

Put Review Stops in runtime order. File order is secondary.

Use multiple ranges when related operations are not adjacent. For example, connect resource setup to resource cleanup.

Keep each Source Frame small. Include enough source to show ownership and execution order.

Review Zen follows the active Focus Block when a Source Frame is taller than the Source pane.

## Language explanation

Each Language item must answer these questions:

- What is the exact token or expression?
- Which language, framework, or project defines it?
- What does it mean here?
- Why does this code use it?
- Which realistic alternatives exist?

Use short and direct answers.

## Intent explanation

The Intent must contain these items:

- Short pseudocode.
- The observable effect.
- The reason for the code.
- The failure that occurs if the code is removed.

Explain behavior before implementation detail.

## Visual explanations

Add a visual only when it makes the active behavior easier to understand.

Use `structure` for a component tree, DOM tree, file tree, or data shape.

Use `flow` for calls, events, messages, or data movement.

Use `state` for important values before and after an operation.

Keep each visual small. Make the active concept the most specific line.

Do not copy the Source Frame into a visual.

Set `"highlightAs": "heex"` for a Source Frame that contains much HEEx code.

For LiveView, use these flows when they apply:

```text
UI event → phx-* binding → handle_event/3 → assign or stream → DOM patch
async task → handle_async/3 → assign or flash → DOM patch
server DOM → phx-hook → browser callback → browser effect
```

## Test evidence

Evidence is a justified claim. Evidence is not line coverage.

Use these evidence states:

- `asserted`: An inspected assertion observes the behavior.
- `exercised`: A test runs the path but does not assert its result directly.
- `unlinked`: The bundle has no linked evidence for the Focus Block.
- `unknown`: The relation was not analyzed.

Use these test kinds:

- `unit`: The test checks one small unit.
- `integration`: The test checks connected application parts.
- `server-dom`: The test checks HTML that the server renders.
- `browser`: The test runs browser behavior.
- `visual`: The test checks layout or appearance.

State the limits of each test.

A server DOM test does not prove JavaScript behavior. It does not prove browser focus. It does not prove CSS layout.

## Open the bundle in Herdr

Run this check:

```bash
test "${HERDR_ENV:-}" = 1 && test -n "${HERDR_WORKSPACE_ID:-}"
```

If the check succeeds, inspect the installed command syntax:

```bash
herdr tab create --help
herdr pane run --help
```

Create and focus a new tab:

```bash
tab_json=$(herdr tab create \
  --workspace "$HERDR_WORKSPACE_ID" \
  --cwd "$PWD" \
  --label "Review Zen" \
  --env "REVIEW_ZEN_FILE=$review_file" \
  --focus)
pane_id=$(printf '%s' "$tab_json" | jq -r '.result.root_pane.pane_id')
herdr pane run "$pane_id" 'cat "$REVIEW_ZEN_FILE" | review-zen -'
```

Read the pane ID from the command result. Inspect the result if its structure is different.

Report the review file path after the tab opens.

## Open the bundle without Herdr

If the Herdr check fails, keep the review file.

Give the user this exact command:

```bash
review-zen /tmp/review-zen/<repo>-<change>.json
```

Tell the user that bundle validation succeeded.

Let the user start and control the TUI.

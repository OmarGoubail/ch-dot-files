---
name: hunk-review
description: "Annotates live Hunk review sessions with sparse high-value agent notes."
---

# Hunk Review

Use this skill proactively when a matching live Hunk session exists for the current repo, or when the user explicitly asks for Hunk annotations/context/navigation. If no matching live session exists and the user did not ask for Hunk, skip Hunk silently and continue with normal tools.

Hunk is an interactive terminal diff viewer. The user owns the TUI; agents use non-interactive `hunk session ...` commands only and never launch the TUI themselves.

## Safety and Scope

- Do **not** run interactive review commands such as `hunk diff`, `hunk show`, `hunk patch`, or `hunk stash show` as an agent.
- If the user explicitly asked for Hunk and no suitable live session exists, ask them to launch Hunk in their terminal instead of starting it yourself; for reviews, suggest `hunk diff --watch --agent-notes` when appropriate.
- If Hunk was not explicitly requested and no suitable live session exists, do not nag or mention Hunk; proceed without it.
- Hunk comments are live session annotations only. They are not persistent review records, GitHub comments, or a substitute for the final response.
- Leave sparse, high-value notes: intent, structure, risks, follow-ups, or why a hunk matters; concise trace/review-guide notes explaining what important functions do and how to follow the flow are encouraged. Do not comment on every hunk.
- This local skill targets `hunk 0.9.3`. Do not use unsupported commands or flags such as `hunk skill path` or `hunk session comment list --type`.

## Session Discovery

Prefer repo targeting from the repository root:

```bash
hunk session list --json
hunk session get --repo . --json
hunk session context --repo . --json
```

If `get --repo .` cannot find a matching live session, proceed without Hunk unless the user explicitly requested Hunk. When they did request it, ask them to open one, for example with `hunk diff --watch --agent-notes` or `hunk show <ref>`, then continue only after a session exists.

## Reading Review Context

Before reading raw patches or adding comments, inspect Hunk's structured review model:

```bash
hunk session review --repo . --json
```

Use `--include-patch` only when the structured JSON is insufficient:

```bash
hunk session review --repo . --json --include-patch
```

Use normal code-reading tools for source files when deeper understanding is needed. Hunk is for diff/session context and annotations, not a replacement for direct code inspection.

## Adding Comments

Use `comment apply` for batches so notes are atomic and less noisy:

```bash
cat <<'JSON' | hunk session comment apply --repo . --stdin --json
{
  "comments": [
    {
      "filePath": "path/from/hunk.ext",
      "hunk": 1,
      "summary": "Short note for the user.",
      "rationale": "Optional detail explaining intent, risk, or follow-up.",
      "author": "Pi"
    }
  ]
}
JSON
```

For a single precise line note, use `comment add` with an old-side or new-side line:

```bash
hunk session comment add --repo . \
  --file path/from/hunk.ext \
  --new-line 42 \
  --summary "Short note for the user." \
  --rationale "Optional detail." \
  --author Pi \
  --json
```

Use file paths exactly as Hunk reports them. Good comments usually fall into one of two categories: intent notes that explain why a change exists or why it matters, and concise trace/review-guide notes that explain what important functions do and how to follow the flow. If you are unsure about the correct hunk or line, check `review`/`context` first or skip the annotation.

## Existing Comments and Navigation

List live comments with:

```bash
hunk session comment list --repo . --json
hunk session comment list --repo . --file path/from/hunk.ext --json
```

Navigate the user's live Hunk session only when asked or when it directly supports the current Hunk workflow:

```bash
hunk session navigate --repo . --file path/from/hunk.ext --hunk 2 --json
hunk session navigate --repo . --next-comment --json
hunk session navigate --repo . --prev-comment --json
```

Use `comment rm` or `comment clear --yes` only when the user explicitly asks to remove live annotations.

## Reloading Sessions

`hunk session reload` can replace the diff shown in an existing live session. Use it only when the user asks, when a task explicitly says to keep an existing Hunk session current, or when you have just made changes and the session is already part of the workflow:

```bash
hunk session reload --repo . --json -- diff
hunk session reload --repo . --json -- show HEAD
```

Do not use reload as a way to create a session; the user still launches the Hunk TUI.

---
name: linear-issue-format
description: Use when creating or updating Linear issues for Jump work. Enforces concise human-owned issue format with AI notes, goals, acceptance criteria, and non-goals.
---

# Linear Issue Format

When creating or updating Linear issues, keep the issue human-owned and concise.

## Principles

- Do not write long AI-generated scope essays.
- Leave `Human summary` for the human unless they explicitly provide wording.
- Put detailed investigation in comments, linked docs, or PR notes — not the issue body.
- One issue should map to one PR-sized outcome.
- Ask before canceling, closing, archiving, or bulk-editing issues.

## Default issue body

Use this format:

```md
## Human summary

<!-- Human fills this in. Why this matters, what prompted it, and any context only they know. -->

## Goal

One clear outcome.

## Notes

AI notes:
- Current behavior:
- Key files / systems:
- Important constraints:
- Open questions:

## Acceptance criteria

- [ ] Small, verifiable outcome
- [ ] Another concrete outcome
- [ ] Tests / verification path

## Non-goals

- What this issue should not solve
```

## Linear usage

Use Linear through mcporter:

```sh
npx mcporter call linear.save_issue --args '<json>' --output markdown
```

For Jump Eval engine work, default to:

- team: `CORE`
- project: `Eval engine`
- assignee: `me`

Only use another team/project if the user says so.

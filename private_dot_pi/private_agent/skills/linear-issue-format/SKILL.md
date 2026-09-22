---
name: linear-issue-format
description: Use when creating or updating Linear issues for Jump work. Enforces self-contained, human-owned tickets with enough context for a fresh agent or engineer to execute without local documents or prior conversations.
---

# Linear Issue Format

When creating or updating Linear issues, write a self-contained handoff for an engineer or agent with no prior conversation context.

## Principles

- Keep prose concise, but preserve the context needed to make implementation decisions correctly.
- Leave `Human summary` for the human unless they explicitly provide wording.
- Put essential behavior, agreed decisions, constraints, dependencies, and unresolved choices in the issue body. Investigation logs and supplementary evidence may live in comments or durable links.
- Local files, prototypes, stashes, and past conversations are optional references, never prerequisites. Restate the relevant design in the ticket; attach necessary visual evidence remotely.
- One issue should map to one bounded outcome. Split independent query, presentation, migration, and enforcement work when they can be delivered separately.
- Distinguish settled requirements from proposed details. Record open decisions and what must resolve them before implementation.
- Ask before canceling, closing, archiving, or bulk-editing issues.

## Handoff check

Before saving, ask: could a fresh engineer or agent execute this with the repository and this Linear issue, without the author's local documents or memory? Include the purpose, current behavior, target behavior and edge cases, source entry points, dependency outcomes, verification, and non-goals needed for that answer to be yes. Links to other Linear issues can identify dependencies; summarize the contract this issue needs from them.

## Default issue body

Use this format, expanding Notes into focused subsections when needed:

```md
## Human summary

<!-- Human fills this in. Why this matters, what prompted it, and any context only they know. -->

## Goal

One clear outcome.

## Notes

AI notes:
- Current behavior and why it needs to change:
- Agreed behavior and important edge cases:
- Key files / systems and ownership:
- Dependencies and the outcomes required from them:
- Important constraints:
- Open decisions to resolve before implementation:

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

---
name: qmd-knowledge
description: Search and capture durable personal and project knowledge in the shared QMD vault. Use when the user asks what was decided before, asks to remember something, or needs context from prior work.
---

# Shared QMD knowledge

The shared QMD vault is hosted on `callisto` and accessed through the local wrappers `qmd-remote` and `qmd-remote-capture`.

## Search workflow

Search before answering when the question may depend on prior knowledge:

```bash
qmd-remote search "exact project term" -n 10
qmd-remote query $'intent: Find the relevant durable decision.\nlex: exact names and terms\nvec: semantic description of the needed knowledge'
```

Retrieve the complete relevant documents before relying on snippets:

```bash
qmd-remote get "#docid"
qmd-remote multi-get "projects/Jump/*.md" --format md
```

Use `qmd-remote search` for exact names and `qmd-remote query` for conceptual recall. Cite retrieved paths and line numbers when reporting facts.

## Capture workflow

Only capture durable knowledge when the user explicitly asks to remember it or the information is clearly a reusable project decision, convention, gotcha, or pattern.

Create a new Markdown note; do not overwrite an existing note:

```bash
qmd-remote-capture topics/topic-name.md <<'EOF'
---
title: Short descriptive title
type: topic
status: active
---

The durable knowledge, written concisely.
EOF
```

Use these paths:

- `projects/<project>/<slug>.md` for project-specific knowledge
- `topics/<slug>.md` for cross-project concepts
- `decisions/<slug>.md` for explicit architectural or workflow decisions
- `inbox/<slug>.md` when classification is unclear

Search first to avoid duplicating an existing note. QMD reindexes new captures automatically. Run `qmd-remote embed` after a batch of captures when semantic search should include them.

## Boundaries

- `notes.md` is transient session scratch, not durable memory.
- QMD indexes Markdown files; it is not itself the source of truth.
- Do not store secrets, tokens, or private credentials.
- Do not silently capture every conversation; durable capture requires explicit user intent.

---
name: qmd-knowledge
description: Search and capture durable personal and project knowledge in the local QMD collection. Use when the user asks what was decided before, asks to remember something, or needs context from prior work.
---

# Local QMD knowledge

The durable knowledge source is the Git repository `~/Documents/knowledge`, registered locally as the QMD collection `knowledge`. QMD's index and embeddings live outside the repository and are rebuilt per machine.

## Search workflow

Search before answering when the question may depend on prior knowledge:

```bash
qmd search "exact project term" -c knowledge -n 10
qmd query $'intent: Find the relevant durable decision.\nlex: exact names and terms\nvec: semantic description of the needed knowledge' -c knowledge -n 10
```

Use `qmd search` for exact names, titles, symbols, or phrases. Use structured `qmd query` for conceptual recall. Do not rely on snippets when the user needs facts, decisions, quotes, or nuance.

Retrieve complete relevant documents before relying on search results:

```bash
qmd get "#docid"
qmd multi-get "qmd://knowledge/projects/Jump/*.md" --format md
```

`qmd get` and `qmd multi-get` include line numbers. Cite the local source path and exact line numbers when reporting retrieved facts.

## Capture workflow

Only capture durable knowledge when the user explicitly asks to remember it or the information is clearly a reusable project decision, convention, gotcha, or pattern.

Create a new Markdown note; do not overwrite an existing note:

```bash
cat > ~/Documents/knowledge/topics/topic-name.md <<'EOF'
---
title: Short descriptive title
type: topic
status: active
---

The durable knowledge, written concisely.
EOF
qmd update
qmd embed -c knowledge
```

Use these paths:

- `projects/<project>/<slug>.md` for project-specific knowledge
- `topics/<slug>.md` for cross-project concepts
- `decisions/<slug>.md` for explicit architectural or workflow decisions
- `inbox/<slug>.md` when classification is unclear

Search first to avoid duplicating an existing note. Commit Markdown changes to the knowledge repository when they should be backed up or synchronized to another machine.

## Boundaries

- `notes.md` is transient session scratch, not durable memory.
- QMD indexes Markdown files; it is not itself the source of truth.
- Do not store secrets, tokens, or private credentials.
- Do not remove collections, alter collection configuration, or clean the index without explicit user approval.
- Do not silently capture every conversation; durable capture requires explicit user intent.

## Sync and setup

On another machine, clone the knowledge repository and register the clone:

```bash
cd ~/Documents/knowledge
qmd collection add "$PWD" --name knowledge
qmd context add qmd://knowledge/ "Shared personal engineering knowledge: projects, topics, decisions, and durable agent notes."
qmd update
qmd embed -c knowledge
```

The repository is the source of truth. Do not commit QMD's SQLite index or embeddings. Do not store secrets, tokens, or private credentials in the vault.

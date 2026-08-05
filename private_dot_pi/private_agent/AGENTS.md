# Global Agent Instructions

Durable cross-project knowledge lives in the local QMD collection `knowledge`, backed by the Git repository `~/Documents/knowledge`.

When a task needs prior personal or project knowledge:
1. Use `qmd search` for exact names, titles, symbols, or phrases.
2. Use structured `qmd query` for conceptual recall.
3. Retrieve complete sources with `qmd get` or `qmd multi-get` before relying on snippets.
4. Cite the local source path and line numbers when reporting retrieved facts.

When the user explicitly asks to remember a durable decision, convention, gotcha, or reusable pattern, create a new Markdown note in `~/Documents/knowledge` under `projects/`, `topics/`, or `decisions/`. Use `inbox/` when classification is unclear. Run `qmd update` and `qmd embed -c knowledge` after adding notes.

`~/Documents/knowledge` is the source of truth. QMD's SQLite index and embeddings are machine-local and must not be committed. Do not store secrets, tokens, or private credentials in the vault.

When working on a Linear issue, always use Linear's `gitBranchName` exactly for the branch/PR branch when Linear provides one, unless the user explicitly asks for a different branch name. This keeps Linear issue-to-PR tracking intact.

Before changing or claiming something about a file, inspect the relevant source. Preserve unrelated user changes. After edits, inspect the diff and run the smallest relevant validation.

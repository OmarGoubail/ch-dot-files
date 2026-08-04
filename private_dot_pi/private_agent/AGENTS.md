# Global Agent Instructions

Durable cross-project knowledge lives in the remote QMD vault on `callisto`.

When a task needs prior personal or project knowledge:
1. Search with `qmd-remote search` or `qmd-remote query`.
2. Retrieve relevant documents with `qmd-remote get` or `qmd-remote multi-get`.
3. Cite the source path and line numbers when using retrieved knowledge.

When the user explicitly asks to remember a durable decision, convention, gotcha, or reusable pattern, capture a new Markdown note with `qmd-remote-capture` under `projects/`, `topics/`, or `decisions/`. Use `inbox/` for uncategorized material.

`notes.md` is transient session scratch only. Do not treat it as the durable knowledge base or commit it.

When working on a Linear issue, always use Linear's `gitBranchName` exactly for the branch/PR branch when Linear provides one, unless the user explicitly asks for a different branch name. This keeps Linear issue-to-PR tracking intact.

Before changing or claiming something about a file, inspect the relevant source. Preserve unrelated user changes. After edits, inspect the diff and run the smallest relevant validation.

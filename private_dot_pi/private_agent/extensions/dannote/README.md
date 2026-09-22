Adapted from Dannote pi dot files, though with some changes.


## Confirm actions

- Default: **autonomous**. A recognized GitHub mutation first returns an agent-facing checkpoint, not a user modal. The agent must call `acknowledge_github_action` with the exact blocked command, confirm requested scope/content review/passed checks, and explain its review. That permits one execution in the same working directory. A changed command needs its own checkpoint; acknowledgements expire when the run ends.
- `/confirm-actions strict` requires human confirmation instead. `/confirm-actions autonomous` restores the default. Mode is stored in the current session branch and inherited by each new/continued subagent run.
- Recursive removal of home, `/`, or their broad contents always requires human approval. Strict/headless child actions return pending actions rather than waiting for UI.
- Ordinary cleanup (including absolute temp paths), local Git operations, publishing/deploy tools, and shell wrappers have no blanket approval gate. Explicit `confirmCommands` settings still add human-only rules.

The shell AST guard recognizes common direct commands, wrappers, and inline shell strings. It is a workflow checkpoint, **not a security sandbox**: arbitrary scripts, aliases, computed paths, shell state changes, non-bash tools, and direct HTTP clients are not comprehensively analyzed. Agent acknowledgement is not human approval and does not override instructions requiring a PR preview or explicit user permission.

The chezmoi migration disables the old standalone `rm-guard.ts`, whose regex checks also mistook quoted test data for live deletion commands. Session switch/fork confirmations are unchanged.

---
description: Linear access and workflow reminder
---

You have access to Linear via `npx mcporter` (server `linear`). Linear is currently configured but may need `npx mcporter auth linear` if the session has not authenticated.

When a Linear issue is involved:

1. Read the issue with mcporter before planning or implementing.
2. Use Linear's `gitBranchName` exactly for the branch/PR branch when Linear provides one, unless the user explicitly asks for a different branch name.
3. Prefer creating/updating Linear issues through mcporter when the user asks for issue tracking.
4. If you need to create a Linear issue, load the `linear-issue-format` skill and follow its concise human-owned format.

Do not guess issue IDs, branch names, or state transitions — use mcporter to query or update Linear.

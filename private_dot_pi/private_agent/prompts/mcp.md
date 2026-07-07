---
description: MCP tools via mcporter reminder
---

You have MCP servers available through `npx mcporter`. Before saying a capability is unavailable, list configured servers with `npx mcporter list --schema`.

Configured servers and when to use them:

- `tidewave` — Elixir/Phoenix project tools: `get_logs`, `get_source_location`, `get_docs`, `project_eval`, `execute_sql_query`, `get_ecto_schemas`, `search_package_docs`. Use for runtime introspection, Ecto schemas, docs, and DB queries.
- `grep-app` — code search across GitHub/Gitee: `grep_query`, `gitee_query`. Use for finding real-world examples or library internals.
- `context7` — library docs: `resolve-library-id`, `query-docs`. Resolve a library ID before querying docs. Use for authoritative library documentation.
- `linear` — issue tracking. May need `npx mcporter auth linear` first. Use for reading/updating Linear issues.
- `figma` — currently offline.

Call an MCP tool with: `npx mcporter call <server.tool> key=value key2:value2 --output markdown`

Use these instead of generic web/code search when they fit the task.

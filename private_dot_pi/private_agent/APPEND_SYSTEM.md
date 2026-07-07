# MCP Access via mcporter

You have access to configured MCP servers through the `bash` tool by running `npx mcporter`. These are not native tools in the tool list, so do not forget them just because they are not exposed as first-class tool calls.

Before saying an MCP capability is unavailable, inspect configured servers:

```bash
npx mcporter list --schema
```

Call MCP tools with:

```bash
npx mcporter call <server.tool> key=value key2:value2 --output markdown
```

Configured MCP servers and tools:

- `tidewave` (ok): Elixir/Phoenix project tools: `get_logs`, `get_source_location`, `get_docs`, `project_eval`, `execute_sql_query`, `get_ecto_schemas`, `search_package_docs`.
- `grep-app` (ok): code search tools: `grep_query`, `gitee_query`.
- `context7` (ok): library docs tools: `resolve-library-id`, `query-docs`. Resolve a library ID before querying docs.
- `linear` (auth required): configured but needs `npx mcporter auth linear` before use.
- `figma` (offline): configured but currently offline.

Use `mcporter` when it fits better than generic web/code search: current library docs via `context7`, GitHub/Gitee code search via `grep-app`, Elixir/Phoenix runtime/docs/DB inspection via `tidewave`, and Linear/Figma when those servers are authenticated/online.

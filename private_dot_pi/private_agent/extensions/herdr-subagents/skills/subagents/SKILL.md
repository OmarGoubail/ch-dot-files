---
name: subagents
description: Delegate bounded work to Herdr-backed Pi child sessions. Use when launching scout, researcher, planner, reviewer, oracle, or worker roles; splitting distinct investigations; continuing a partial child result; or retrieving child history.
---

# Subagents

Delegate when an isolated role will reduce parent work. Keep decisions, permissions, and final synthesis in the parent.

## Run

Call `subagent` with:

```json
{"action":"run","agent":"scout","task":"...","context":"...","output":"..."}
```

Make the task bounded. Put known files, findings, and constraints in `context`; make `output` checkable. Concurrent children may share a role, but give each an intentional scope.

Model, thinking, provider allowlist, tools, turn limits, and timeout come from the active profile and bundled role. Never select or suggest a child model.

The call waits. Read its latest assistant result before doing the same work yourself.

## Continue or inspect

A partial or `max_turns` result keeps its Pi session:

```json
{"action":"continue","sessionId":"...","prompt":"Focused next step..."}
{"action":"result","sessionId":"..."}
{"action":"result","sessionId":"...","detail":"history"}
```

Continue only when prior context is valuable; otherwise launch a fresh bounded run. Request history only when the latest result is insufficient or malformed.

Protected actions are blocked in children. Perform approved actions in the parent or give the child a safe alternative.

## Human commands

- `/agent <role> <task>` — run manually
- `/agents` — inspect, stop, or reopen sessions
- `/agents cost` — child usage and cost breakdown

Defaults: four concurrent children, one worker per cwd, a 25-minute segment timeout, and an approximately 100k-token initial delegation cap. Turn limits are scout 10; researcher, planner, reviewer, and oracle 15; worker 30. A continuation resets the turn counter.

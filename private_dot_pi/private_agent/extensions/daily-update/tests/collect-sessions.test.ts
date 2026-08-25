import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectDailyWorkEvidence } from "../collect-sessions.ts";

function sessionRoot(entries: object[]): string {
	const root = mkdtempSync(join(tmpdir(), "daily-update-"));
	const project = join(root, "project");
	mkdirSync(project);
	writeFileSync(join(project, "session.jsonl"), entries.map((entry) => JSON.stringify(entry)).join("\n"));
	return root;
}

const header = {
	type: "session",
	version: 3,
	id: "session-1",
	timestamp: "2026-08-24T08:00:00.000Z",
	cwd: "/workspace/jump",
};

function profile(id: string, parentId: string | null, name: string, timestamp = "2026-08-24T08:00:01.000Z") {
	return { type: "custom", id, parentId, timestamp, customType: "profiles.selection", data: { profile: name } };
}

function message(id: string, parentId: string, timestamp: string, value: object) {
	return { type: "message", id, parentId, timestamp, message: value };
}

test("collects only the work-profile branch and pairs successful actions with outcomes", () => {
	const root = sessionRoot([
		header,
		profile("personal-profile", null, "personal"),
		message("personal-user", "personal-profile", "2026-08-24T09:00:00.000Z", { role: "user", content: "Personal task" }),
		message("personal-answer", "personal-user", "2026-08-24T09:01:00.000Z", {
			role: "assistant",
			content: [{ type: "text", text: "Finished personal task" }],
			stopReason: "stop",
		}),
		profile("work-profile", "personal-profile", "work"),
		message("work-user", "work-profile", "2026-08-24T10:00:00.000Z", { role: "user", content: "Fix PC-123" }),
		message("work-call", "work-user", "2026-08-24T10:01:00.000Z", {
			role: "assistant",
			content: [{ type: "toolCall", id: "call-1", name: "edit", arguments: { path: "lib/example.ex", edits: [{ op: "replace" }] } }],
			stopReason: "toolUse",
		}),
		message("work-result", "work-call", "2026-08-24T10:02:00.000Z", {
			role: "toolResult",
			toolCallId: "call-1",
			toolName: "edit",
			content: [{ type: "text", text: "Updated file" }],
			isError: false,
		}),
		message("work-answer", "work-result", "2026-08-24T10:03:00.000Z", {
			role: "assistant",
			content: [{ type: "text", text: "Fixed PC-123 and verified the behavior." }],
			stopReason: "stop",
		}),
	]);

	const evidence = collectDailyWorkEvidence({ date: "2026-08-24", timeZone: "UTC", sessionRoot: root });
	assert.equal(evidence.sessionCount, 1);
	assert.equal(evidence.tasks.length, 1);
	assert.equal(evidence.tasks[0]?.userPrompt, "Fix PC-123");
	assert.deepEqual(evidence.tasks[0]?.assistantOutcomes, ["Fixed PC-123 and verified the behavior."]);
	assert.deepEqual(evidence.tasks[0]?.actions, [{
		name: "edit",
		summary: "Edited lib/example.ex (1 operation)",
		status: "succeeded",
	}]);
});

test("filters individual activity timestamps in the requested timezone", () => {
	const root = sessionRoot([
		header,
		profile("work-profile", null, "work", "2026-08-23T20:00:00.000Z"),
		message("before-local-midnight", "work-profile", "2026-08-23T20:30:00.000Z", { role: "user", content: "Too early" }),
		message("before-answer", "before-local-midnight", "2026-08-23T20:31:00.000Z", {
			role: "assistant",
			content: [{ type: "text", text: "Previous local day" }],
			stopReason: "stop",
		}),
		message("target-user", "before-answer", "2026-08-23T22:30:00.000Z", { role: "user", content: "Target local day" }),
		message("target-answer", "target-user", "2026-08-23T22:31:00.000Z", {
			role: "assistant",
			content: [{ type: "text", text: "Included local day" }],
			stopReason: "stop",
		}),
	]);

	const evidence = collectDailyWorkEvidence({
		date: "2026-08-24",
		timeZone: "Asia/Amman",
		sessionRoot: root,
	});
	assert.equal(evidence.tasks.length, 1);
	assert.equal(evidence.tasks[0]?.userPrompt, "Target local day");
});

test("excludes unmarked sessions and intent without outcome evidence", () => {
	const unmarkedRoot = sessionRoot([
		header,
		message("user", "missing-parent", "2026-08-24T10:00:00.000Z", { role: "user", content: "Unmarked" }),
		message("answer", "user", "2026-08-24T10:01:00.000Z", {
			role: "assistant",
			content: [{ type: "text", text: "Should not appear" }],
			stopReason: "stop",
		}),
	]);
	assert.equal(collectDailyWorkEvidence({ date: "2026-08-24", timeZone: "UTC", sessionRoot: unmarkedRoot }).tasks.length, 0);

	const intentRoot = sessionRoot([
		header,
		profile("work-profile", null, "work"),
		message("user", "work-profile", "2026-08-24T10:00:00.000Z", { role: "user", content: "Please ship this" }),
	]);
	assert.equal(collectDailyWorkEvidence({ date: "2026-08-24", timeZone: "UTC", sessionRoot: intentRoot }).tasks.length, 0);
});

test("redacts credentials and omits code blocks from collected evidence", () => {
	const root = sessionRoot([
		header,
		profile("work-profile", null, "work"),
		message("user", "work-profile", "2026-08-24T10:00:00.000Z", { role: "user", content: "Check password=hunter2" }),
		message("call", "user", "2026-08-24T10:01:00.000Z", {
			role: "assistant",
			content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: { command: "curl -H 'Authorization=secret-value' example.test" } }],
			stopReason: "toolUse",
		}),
		message("result", "call", "2026-08-24T10:02:00.000Z", {
			role: "toolResult",
			toolCallId: "call-1",
			toolName: "bash",
			content: [{ type: "text", text: "Bearer abcdefghijklmnop\n```ts\nconst secret = true\n```" }],
			isError: false,
		}),
	]);

	const serialized = JSON.stringify(collectDailyWorkEvidence({ date: "2026-08-24", timeZone: "UTC", sessionRoot: root }));
	assert.doesNotMatch(serialized, /hunter2|secret-value|abcdefghijklmnop|const secret/);
	assert.match(serialized, /\[redacted\]|\[code omitted\]/);
});

test("does not collect shell commands excluded from Pi context", () => {
	const root = sessionRoot([
		header,
		profile("work-profile", null, "work"),
		message("user", "work-profile", "2026-08-24T10:00:00.000Z", { role: "user", content: "Run a private check" }),
		message("hidden", "user", "2026-08-24T10:01:00.000Z", {
			role: "bashExecution",
			command: "cat ~/.ssh/private-key",
			output: "private shell output",
			exitCode: 0,
			excludeFromContext: true,
		}),
	]);

	const serialized = JSON.stringify(collectDailyWorkEvidence({ date: "2026-08-24", timeZone: "UTC", sessionRoot: root }));
	assert.doesNotMatch(serialized, /private-key|private shell output/);
	assert.equal(JSON.parse(serialized).tasks.length, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForTerminalChildState } from "../child-state.ts";

function state(status: "starting" | "running" | "complete") {
	return {
		version: 1 as const,
		sessionId: "session",
		status,
		expectedModel: "provider/model",
		latestAssistant: status === "complete" ? "done" : "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
		maxTurns: 10,
		blockedActions: [],
		updatedAt: new Date().toISOString(),
	};
}

test("waits through running state until child telemetry is terminal", async () => {
	const directory = mkdtempSync(join(tmpdir(), "child-state-test-"));
	const path = join(directory, "state.json");
	writeFileSync(path, JSON.stringify(state("running")));
	const timer = setTimeout(() => writeFileSync(path, JSON.stringify(state("complete"))), 20);
	try {
		const result = await waitForTerminalChildState(path, { timeoutMs: 500, pollIntervalMs: 5 });
		assert.equal(result.status, "complete");
		assert.equal(result.latestAssistant, "done");
	} finally {
		clearTimeout(timer);
		rmSync(directory, { recursive: true, force: true });
	}
});

test("fails explicitly when child telemetry never becomes terminal", async () => {
	const directory = mkdtempSync(join(tmpdir(), "child-state-test-"));
	const path = join(directory, "state.json");
	writeFileSync(path, JSON.stringify(state("running")));
	try {
		await assert.rejects(
			waitForTerminalChildState(path, { timeoutMs: 20, pollIntervalMs: 5 }),
			/telemetry timed out.*running/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

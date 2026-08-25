import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HerdrClient } from "../herdr.ts";

test("delegation submits a fixed command instead of prompt text through argv", async () => {
	const directory = mkdtempSync(join(tmpdir(), "herdr-client-test-"));
	const binary = join(directory, "fake-herdr");
	const capture = join(directory, "args.txt");
	writeFileSync(binary, `#!/bin/sh\nprintf '%s\\n' "$@" > "$HERDR_TEST_ARGS"\nprintf '{"result":{}}\\n'\n`);
	chmodSync(binary, 0o700);
	const previousCapture = process.env.HERDR_TEST_ARGS;
	process.env.HERDR_TEST_ARGS = capture;
	try {
		const client = new HerdrClient(binary);
		await client.delegate({ target: "probe", timeoutMs: 1_000 });
		assert.deepEqual(readFileSync(capture, "utf8").trim().split("\n"), [
			"agent",
			"prompt",
			"probe",
			"/herdr-delegate",
			"--wait",
			"--timeout",
			"1000",
		]);
	} finally {
		if (previousCapture === undefined) delete process.env.HERDR_TEST_ARGS;
		else process.env.HERDR_TEST_ARGS = previousCapture;
		rmSync(directory, { recursive: true, force: true });
	}
});

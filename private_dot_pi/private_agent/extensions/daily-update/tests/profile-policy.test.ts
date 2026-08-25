import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { activeProfileModelError } from "../profile-policy.ts";

function profilesFile(): string {
	const path = join(mkdtempSync(join(tmpdir(), "daily-update-profiles-")), "profiles.json");
	writeFileSync(path, JSON.stringify({
		active_profile: "personal",
		profiles: {
			personal: {
				model: "openai-codex-personal/luna",
				allowed_providers: ["openai-codex-personal"],
				subagents: {},
			},
			work: {
				model: "openai-codex-work/sol",
				allowed_providers: ["openai-codex-work", "fireworks"],
				subagents: {},
			},
		},
	}));
	return path;
}

test("accepts only providers allowed by the selected work profile", () => {
	const path = profilesFile();
	assert.equal(activeProfileModelError("work", "openai-codex-work", "sol", path), undefined);
	assert.equal(activeProfileModelError("work", "fireworks", "flash", path), undefined);
	assert.match(
		activeProfileModelError("work", "openai-codex-personal", "luna", path) ?? "",
		/forbidden by profile 'work'/,
	);
});

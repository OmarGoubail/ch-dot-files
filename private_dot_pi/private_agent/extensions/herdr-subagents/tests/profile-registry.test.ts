import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PROFILE_SELECTION_ENTRY_TYPE, ProfileRegistry, modelPolicyError, profileSelectionFromEntries, readParentProfileState, readProfiles, writeParentProfileState } from "../../shared/profile-registry.ts";

function fixture() {
	const dir = mkdtempSync(join(tmpdir(), "profile-registry-"));
	const profilesPath = join(dir, "profiles.json");
	const parentStatePath = join(dir, "profile-state.json");
	writeFileSync(profilesPath, JSON.stringify({
		active_profile: "personal",
		profiles: {
			personal: {
				model: "openai-codex-personal/luna",
				thinking: "high",
				allowed_providers: ["openai-codex-personal", "opencode-go"],
				subagents: { scout: { model: "opencode-go/flash", thinking: "off" } },
			},
			work: {
				model: "openai-codex-work/sol",
				thinking: "medium",
				allowed_providers: ["openai-codex-work"],
				subagents: { scout: { model: "openai-codex-work/luna", thinking: "off" } },
			},
		},
	}));
	return { profilesPath, parentStatePath };
}

test("loads provider policy and preserves an explicit session selection", () => {
	const paths = fixture();
	const registry = new ProfileRegistry(paths.profilesPath);
	registry.reload();
	assert.equal(registry.selectedName(), "personal");
	assert.equal(registry.resolveSubagent("scout")?.policy.model, "opencode-go/flash");
	assert.equal(registry.select("work"), true);
	registry.reload({ preserveSelection: true });
	assert.equal(registry.selectedName(), "work");
});

test("recovers the latest profile selection from the parent session branch", () => {
	const entries = [
		{ type: "custom", customType: PROFILE_SELECTION_ENTRY_TYPE, data: { profile: "personal" } },
		{ type: "custom", customType: PROFILE_SELECTION_ENTRY_TYPE, data: { profile: "work" } },
	];
	assert.equal(profileSelectionFromEntries(entries), "work");
});

test("keeps parent model stickiness in its separate state file", () => {
	const paths = fixture();
	const state = { work: { model: "openai-codex-work/luna", thinking: "xhigh" as const } };
	assert.equal(writeParentProfileState(state, paths.parentStatePath), true);
	assert.deepEqual(readParentProfileState(paths.parentStatePath), state);
});

test("rejects a model outside the profile provider allowlist", () => {
	const paths = fixture();
	const result = readProfiles(paths.profilesPath);
	const profile = result.config.profiles.personal;
	assert.match(modelPolicyError("personal", profile, { model: "openai-codex-work/sol" }, "Agent") ?? "", /forbidden/);
	assert.equal(modelPolicyError("personal", profile, { model: "opencode-go/flash" }, "Agent"), undefined);
});

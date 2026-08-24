/**
 * Pi account profiles.
 *
 * ~/.pi/agent/profiles.json contains account-level model and thinking policy.
 * This extension deliberately does not load prompts or alter the system prompt.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
type JsonRecord = Record<string, unknown>;

type ModelPolicy = {
	model?: string;
	thinking?: ThinkingLevel;
};

type Profile = ModelPolicy & {
	subagents: Record<string, ModelPolicy>;
};

type ProfilesFile = {
	active_profile?: string;
	profiles: Record<string, Profile>;
};

type ModelSpec = {
	provider: string;
	id: string;
};

const CONFIG_PATH = join(homedir(), ".pi", "agent", "profiles.json");
const STATE_PATH = join(homedir(), ".pi", "agent", "profile-state.json");
const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");
const THINKING_LEVELS = new Set<ThinkingLevel>(["off", "minimal", "low", "medium", "high", "xhigh"]);

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asThinking(value: unknown, label: string, warnings: string[]): ThinkingLevel | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string" && THINKING_LEVELS.has(value as ThinkingLevel)) return value as ThinkingLevel;
	warnings.push(`${label} has invalid thinking level ${JSON.stringify(value)}; expected off, minimal, low, medium, high, or xhigh.`);
	return undefined;
}

function asPolicy(value: unknown, label: string, warnings: string[]): ModelPolicy {
	if (!isRecord(value)) {
		warnings.push(`${label} must be a mapping.`);
		return {};
	}

	const policy: ModelPolicy = {};
	if (value.model !== undefined) {
		if (typeof value.model === "string" && value.model.trim()) policy.model = value.model.trim();
		else warnings.push(`${label}.model must be a non-empty provider/model string.`);
	}
	policy.thinking = asThinking(value.thinking, `${label}.thinking`, warnings);
	return policy;
}

function readProfiles(): { config: ProfilesFile; warnings: string[] } {
	const warnings: string[] = [];
	if (!existsSync(CONFIG_PATH)) {
		return { config: { profiles: {} }, warnings: [`Missing ${CONFIG_PATH}.`] };
	}

	try {
		const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as JsonRecord;
		const profiles: Record<string, Profile> = {};
		if (parsed.profiles !== undefined && !isRecord(parsed.profiles)) {
			warnings.push("profiles must be a mapping.");
		} else if (isRecord(parsed.profiles)) {
			for (const [name, rawProfile] of Object.entries(parsed.profiles)) {
				if (!isRecord(rawProfile)) {
					warnings.push(`profiles.${name} must be a mapping.`);
					continue;
				}
				const profilePolicy = asPolicy(rawProfile, `profiles.${name}`, warnings);
				const subagents: Record<string, ModelPolicy> = {};
				if (rawProfile.subagents !== undefined && !isRecord(rawProfile.subagents)) {
					warnings.push(`profiles.${name}.subagents must be a mapping.`);
				} else if (isRecord(rawProfile.subagents)) {
					for (const [agent, rawPolicy] of Object.entries(rawProfile.subagents)) {
						subagents[agent] = asPolicy(rawPolicy, `profiles.${name}.subagents.${agent}`, warnings);
					}
				}
				profiles[name] = { ...profilePolicy, subagents };
			}
		}

		const activeProfile = typeof parsed.active_profile === "string" ? parsed.active_profile.trim() : undefined;
		if (parsed.active_profile !== undefined && !activeProfile) warnings.push("active_profile must be a non-empty profile name.");
		return { config: { active_profile: activeProfile, profiles }, warnings };
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		return { config: { profiles: {} }, warnings: [`Could not read ${CONFIG_PATH}: ${detail}`] };
	}
}

type StickyPolicy = {
	model?: string;
	thinking?: ThinkingLevel;
};

type StateFile = Record<string, StickyPolicy>;

function readState(): StateFile {
	try {
		if (!existsSync(STATE_PATH)) return {};
		const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8"));
		if (!isRecord(parsed)) return {};
		const result: StateFile = {};
		for (const [name, raw] of Object.entries(parsed)) {
			if (!isRecord(raw)) continue;
			const entry: StickyPolicy = {};
			if (typeof raw.model === "string" && raw.model.trim()) entry.model = raw.model.trim();
			entry.thinking = asThinking(raw.thinking, `${name}.thinking`, []);
			result[name] = entry;
		}
		return result;
	} catch {
		return {};
	}
}

function writeState(state: StateFile): void {
	try {
		writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
	} catch {
		// Sticky state is a convenience; ignore write failures.
	}
}


function parseModelSpec(value: string): ModelSpec | undefined {
	const slash = value.indexOf("/");
	if (slash <= 0 || slash === value.length - 1) return undefined;
	const provider = value.slice(0, slash);
	let id = value.slice(slash + 1);
	const colon = id.lastIndexOf(":");
	if (colon > 0 && THINKING_LEVELS.has(id.slice(colon + 1) as ThinkingLevel)) id = id.slice(0, colon);
	return id ? { provider, id } : undefined;
}

function modelLabel(policy: ModelPolicy | undefined): string {
	if (!policy?.model) return "session model";
	return policy.thinking ? `${policy.model}:${policy.thinking}` : policy.model;
}

function modelDiagnostic(policy: ModelPolicy | undefined, ctx: ExtensionContext): string {
	if (!policy?.model) return "session model";
	const spec = parseModelSpec(policy.model);
	if (!spec) return `${policy.model} — invalid (expected provider/model)`;

	const model = ctx.modelRegistry.find(spec.provider, spec.id);
	if (!model) return `${policy.model} — unavailable (provider/model not in registry)`;

	let authenticated = false;
	try {
		authenticated = ctx.modelRegistry.hasConfiguredAuth(model);
	} catch {
		// setModel below remains the final auth check for providers with dynamic auth.
	}
	if (!authenticated) return `${policy.model} — unauthenticated (run /login ${spec.provider} or configure its API key)`;
	const provider = ctx.modelRegistry.getProviderDisplayName(spec.provider);
	return `${policy.model} — ready (${provider})`;
}

function notify(ctx: ExtensionContext, message: string, type: "info" | "warning" | "error" = "info"): void {
	if (ctx.hasUI) ctx.ui.notify(message, type);
}

export default function profiles(pi: ExtensionAPI): void {
	if (process.env.PI_SUBAGENT_CHILD === "1") return;
	pi.registerFlag("profile", {
		description: "Initial account profile (for example, work or personal)",
		type: "string",
	});

	let config: ProfilesFile = { profiles: {} };
	let currentProfile = "";
	let loadWarnings: string[] = [];
	let state: StateFile = {};
	let applyingProfile = false;
	let appliedModel: string | undefined;

	function profileNames(): string[] {
		return Object.keys(config.profiles).sort((a, b) => a.localeCompare(b));
	}

	function chooseProfile(preferred?: string): string | undefined {
		if (preferred && config.profiles[preferred]) return preferred;
		if (config.active_profile && config.profiles[config.active_profile]) return config.active_profile;
		return profileNames()[0];
	}

	function load(preferred?: string): string | undefined {
		const result = readProfiles();
		config = result.config;
		loadWarnings = result.warnings;
		state = readState();
		currentProfile = chooseProfile(preferred) || "";
		return currentProfile || undefined;
	}

	async function trySetModel(modelSpec: string, ctx: ExtensionContext, issues: string[]): Promise<boolean> {
		const spec = parseModelSpec(modelSpec);
		const model = spec ? ctx.modelRegistry.find(spec.provider, spec.id) : undefined;
		if (!model) {
			issues.push(`${modelSpec} is unavailable (provider/model not in registry)`);
			return false;
		}
		let authenticated = true;
		try {
			authenticated = ctx.modelRegistry.hasConfiguredAuth(model);
		} catch {
			// setModel below provides the definitive check.
		}
		if (!authenticated) issues.push(`${modelSpec} is unauthenticated (run /login ${spec!.provider} or configure its API key)`);
		const switched = await pi.setModel(model);
		if (!switched) {
			issues.push(`${modelSpec} is unauthenticated or unavailable; session model was not changed`);
			return false;
		}
		appliedModel = modelSpec;
		return true;
	}

	async function applyProfile(profileName: string, ctx: ExtensionContext, reason: "startup" | "switch" | "reload"): Promise<void> {
		const profile = config.profiles[profileName];
		if (!profile) {
			notify(ctx, `Unknown profile: ${profileName}`, "error");
			return;
		}

		currentProfile = profileName;
		syncSubagentOverrides(profileName);
		if (ctx.hasUI) ctx.ui.setStatus("profile", `Profile: ${currentProfile}`);

		const sticky = state[profileName];
		const policy: ModelPolicy = {
			model: sticky?.model ?? profile.model,
			thinking: sticky?.thinking ?? profile.thinking,
		};
		const usingSticky = sticky?.model !== undefined && sticky.model !== profile.model;

		const issues: string[] = [];
		applyingProfile = true;
		try {
			if (policy.model) {
				const applied = await trySetModel(policy.model, ctx, issues);
				if (!applied && usingSticky && profile.model) {
					issues.push(`Fell back to profile default ${profile.model}`);
					await trySetModel(profile.model, ctx, issues);
				}
			}
			if (policy.thinking) pi.setThinkingLevel(policy.thinking);
		} finally {
			applyingProfile = false;
		}

		const prefix = reason === "startup" ? "Profile" : reason === "switch" ? "Switched profile" : "Reloaded profile";
		const summary = `${prefix}: ${currentProfile} • ${modelLabel(policy)}${usingSticky ? " (last used)" : ""} • thinking: ${policy.thinking || "session default"}`;
		notify(ctx, issues.length ? `${summary}\n${issues.join("\n")}` : summary, issues.length ? "warning" : "info");
		for (const warning of loadWarnings) notify(ctx, warning, "warning");
	}

	function profileStatus(ctx: ExtensionContext): string {
		if (!currentProfile || !config.profiles[currentProfile]) return `No profile loaded. Config: ${CONFIG_PATH}`;
		const profile = config.profiles[currentProfile];
		const lines = [
			`Profile: ${currentProfile}${config.active_profile ? ` (configured active: ${config.active_profile})` : ""}`,
			`Account model: ${modelDiagnostic(profile, ctx)}`,
			...(state[currentProfile]?.model
				? [`Last used: ${state[currentProfile].thinking ? `${state[currentProfile].model}:${state[currentProfile].thinking}` : state[currentProfile].model}`]
				: []),
			`Thinking: ${profile.thinking || "session default"}`,
			"Subagents:",
		];
		for (const name of Object.keys(profile.subagents).sort()) {
			const policy = profile.subagents[name];
			lines.push(`  ${name}: ${modelDiagnostic(policy, ctx)}${policy.thinking ? `; thinking ${policy.thinking}` : ""}`);
		}
		if (Object.keys(profile.subagents).length === 0) lines.push("  (none; subagents inherit their configured defaults)");
		if (loadWarnings.length) lines.push(`Warnings: ${loadWarnings.join(" | ")}`);
		return lines.join("\n");
	}

	function subagentOverride(agentName: string): string | undefined {
		const policy = config.profiles[currentProfile]?.subagents[agentName];
		if (!policy?.model) return undefined;
		return policy.thinking ? `${policy.model}:${policy.thinking}` : policy.model;
	}
	function syncSubagentOverrides(profileName: string): void {
		const profile = config.profiles[profileName];
		if (!profile) return;
		const entries = Object.entries(profile.subagents);
		if (entries.length === 0) return;

		let settings: JsonRecord = {};
		if (existsSync(SETTINGS_PATH)) {
			try {
				const parsed = JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) as unknown;
				if (isRecord(parsed)) settings = parsed;
			} catch {
				return;
			}
		}

		const subagents: JsonRecord = isRecord(settings.subagents) ? settings.subagents : {};
		const existingOverrides: JsonRecord = isRecord(subagents.agentOverrides) ? subagents.agentOverrides : {};
		const nextOverrides: JsonRecord = { ...existingOverrides };

		for (const [name, policy] of entries) {
			if (!policy.model) continue;
			nextOverrides[name] = {
				...(isRecord(nextOverrides[name]) ? nextOverrides[name] : {}),
				model: policy.model,
				...(policy.thinking ? { thinking: policy.thinking } : {}),
			};
		}

		settings.subagents = {
			...subagents,
			agentOverrides: nextOverrides,
		};

		try {
			writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
		} catch {
			// Best-effort sync; ignore write failures.
		}
	}

	function patchTask(task: JsonRecord, ctx: ExtensionContext): boolean {
		if (Object.prototype.hasOwnProperty.call(task, "model") || typeof task.agent !== "string") return false;
		const override = subagentOverride(task.agent);
		if (!override) return false;
		task.model = override;
		const policy = config.profiles[currentProfile]?.subagents[task.agent];
		const diagnostic = modelDiagnostic(policy, ctx);
		if (!diagnostic.endsWith("ready)")) notify(ctx, `Subagent ${task.agent}: ${diagnostic}`, "warning");
		return true;
	}

	function patchSubagentInput(input: JsonRecord, ctx: ExtensionContext): number {
		if (typeof input.action === "string") return 0;
		let patched = 0;
		const visit = (value: unknown): void => {
			if (Array.isArray(value)) {
				for (const item of value) visit(item);
				return;
			}
			if (!isRecord(value)) return;
			if (patchTask(value, ctx)) patched++;
			for (const key of ["tasks", "chain", "parallel"]) {
				if (key in value) visit(value[key]);
			}
		};
		for (const key of ["tasks", "chain", "parallel"]) {
			if (key in input) visit(input[key]);
		}
		if (!("tasks" in input) && !("chain" in input) && !("parallel" in input)) patchTask(input, ctx);
		return patched;
	}

	pi.on("session_start", async (_event, ctx) => {
		const requested = pi.getFlag("profile");
		load(typeof requested === "string" ? requested : undefined);
		if (!currentProfile) {
			notify(ctx, `No profiles configured in ${CONFIG_PATH}`, "warning");
			return;
		}
		await applyProfile(currentProfile, ctx, "startup");
	});

	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "subagent") return;
		patchSubagentInput(event.input, ctx);
	});

	pi.on("model_select", (event, ctx) => {
		const spec = `${event.model.provider}/${event.model.id}`;
		if (spec === appliedModel) {
			appliedModel = undefined;
			return;
		}
		if (applyingProfile || !currentProfile || event.source === "restore") return;
		const thinking = THINKING_LEVELS.has(ctx.thinkingLevel as ThinkingLevel) ? (ctx.thinkingLevel as ThinkingLevel) : undefined;
		state[currentProfile] = { model: spec, thinking };
		writeState(state);
	});

	pi.on("thinking_level_select", (event) => {
		if (applyingProfile || !currentProfile) return;
		if (!THINKING_LEVELS.has(event.level as ThinkingLevel)) return;
		state[currentProfile] = { ...state[currentProfile], thinking: event.level as ThinkingLevel };
		writeState(state);
	});

	pi.registerCommand("profile", {
		description: "Switch account profile, inspect status, or reload profiles.json",
		getArgumentCompletions: (prefix: string) => {
			const items = ["status", "reload", "reset", ...profileNames()];
			const trimmed = prefix.trim();
			return items.filter((value) => value.startsWith(trimmed)).map((value) => ({ value, label: value }));
		},
		handler: async (args, ctx) => {
			const arg = args.trim();
			if (arg === "status") {
				notify(ctx, profileStatus(ctx));
				return;
			}
			if (arg === "reload") {
				load(currentProfile);
				if (!currentProfile) {
					notify(ctx, `No profiles configured in ${CONFIG_PATH}`, "warning");
					return;
				}
				await applyProfile(currentProfile, ctx, "reload");
				return;
			}
			if (arg === "reset") {
				if (!currentProfile) {
					notify(ctx, `No profiles configured in ${CONFIG_PATH}`, "warning");
					return;
				}
				delete state[currentProfile];
				writeState(state);
				await applyProfile(currentProfile, ctx, "reload");
				return;
			}

			let profileName = arg;
			if (!profileName) {
				const names = profileNames();
				if (names.length === 0) {
					notify(ctx, `No profiles configured in ${CONFIG_PATH}`, "warning");
					return;
				}
				const choice = await ctx.ui.select("Select Profile", names);
				if (choice === undefined) return;
				profileName = choice;
			}
			if (!config.profiles[profileName]) {
				notify(ctx, `Unknown profile: ${profileName}. Available: ${profileNames().join(", ")}`, "error");
				return;
			}
			await applyProfile(profileName, ctx, "switch");
		},
	});

}

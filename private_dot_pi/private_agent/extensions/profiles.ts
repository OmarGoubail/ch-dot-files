/**
 * Pi account profiles.
 *
 * ~/.pi/agent/profiles.yaml contains account-level model and thinking policy.
 * This extension deliberately does not load prompts or alter the system prompt.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
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

const CONFIG_PATH = join(homedir(), ".pi", "agent", "profiles.yaml");
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

function stripComment(value: string): string {
	let quote: string | undefined;
	for (let index = 0; index < value.length; index++) {
		const character = value[index];
		if (quote) {
			if (character === quote) quote = undefined;
			continue;
		}
		if (character === "\"" || character === "'") quote = character;
		else if (character === "#" && (index === 0 || /\s/.test(value[index - 1] || ""))) return value.slice(0, index).trimEnd();
	}
	return value.trimEnd();
}

function scalar(value: string): string {
	const trimmed = stripComment(value.trim());
	if (trimmed.length >= 2 && ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function parseCompactYaml(raw: string): JsonRecord {
	const root: JsonRecord = {};
	const stack: Array<{ indent: number; value: JsonRecord }> = [{ indent: -1, value: root }];
	for (const line of raw.split(/\r?\n/)) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;
		const indent = line.search(/\S/);
		const content = stripComment(line.trim());
		const separator = content.indexOf(":");
		if (separator <= 0) continue;
		const key = scalar(content.slice(0, separator));
		const value = content.slice(separator + 1).trim();
		while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) stack.pop();
		const parent = stack[stack.length - 1]!.value;
		if (value) parent[key] = scalar(value);
		else {
			const child: JsonRecord = {};
			parent[key] = child;
			stack.push({ indent, value: child });
		}
	}
	return root;
}

function readProfiles(): { config: ProfilesFile; warnings: string[] } {
	const warnings: string[] = [];
	if (!existsSync(CONFIG_PATH)) {
		return { config: { profiles: {} }, warnings: [`Missing ${CONFIG_PATH}.`] };
	}

	try {
		const parsed = parseCompactYaml(readFileSync(CONFIG_PATH, "utf8"));
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
	pi.registerFlag("profile", {
		description: "Initial account profile (for example, work or personal)",
		type: "string",
	});

	let config: ProfilesFile = { profiles: {} };
	let currentProfile = "";
	let loadWarnings: string[] = [];

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
		currentProfile = chooseProfile(preferred) || "";
		return currentProfile || undefined;
	}

	async function applyProfile(profileName: string, ctx: ExtensionContext, reason: "startup" | "switch" | "reload"): Promise<void> {
		const profile = config.profiles[profileName];
		if (!profile) {
			notify(ctx, `Unknown profile: ${profileName}`, "error");
			return;
		}

		currentProfile = profileName;
		if (ctx.hasUI) ctx.ui.setStatus("profile", `Profile: ${currentProfile}`);

		const issues: string[] = [];
		if (profile.model) {
			const spec = parseModelSpec(profile.model);
			const model = spec ? ctx.modelRegistry.find(spec.provider, spec.id) : undefined;
			if (!model) {
				issues.push(`${profile.model} is unavailable (provider/model not in registry)`);
			} else {
				let authenticated = true;
				try {
					authenticated = ctx.modelRegistry.hasConfiguredAuth(model);
				} catch {
					// setModel below provides the definitive check.
				}
				if (!authenticated) issues.push(`${profile.model} is unauthenticated (run /login ${spec!.provider} or configure its API key)`);
				const switched = await pi.setModel(model);
				if (!switched) issues.push(`${profile.model} is unauthenticated or unavailable; session model was not changed`);
			}
		}
		if (profile.thinking) pi.setThinkingLevel(profile.thinking);

		const prefix = reason === "startup" ? "Profile" : reason === "switch" ? "Switched profile" : "Reloaded profile";
		const summary = `${prefix}: ${currentProfile} • ${modelLabel(profile)} • thinking: ${profile.thinking || "session default"}`;
		notify(ctx, issues.length ? `${summary}\n${issues.join("\n")}` : summary, issues.length ? "warning" : "info");
		for (const warning of loadWarnings) notify(ctx, warning, "warning");
	}

	function profileStatus(ctx: ExtensionContext): string {
		if (!currentProfile || !config.profiles[currentProfile]) return `No profile loaded. Config: ${CONFIG_PATH}`;
		const profile = config.profiles[currentProfile];
		const lines = [
			`Profile: ${currentProfile}${config.active_profile ? ` (configured active: ${config.active_profile})` : ""}`,
			`Account model: ${modelDiagnostic(profile, ctx)}`,
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

	pi.registerCommand("profile", {
		description: "Switch account profile, inspect status, or reload profiles.yaml",
		getArgumentCompletions: (prefix: string) => {
			const items = ["status", "reload", ...profileNames()];
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

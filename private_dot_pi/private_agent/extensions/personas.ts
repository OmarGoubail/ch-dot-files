/**
 * Personas — profile-aware persona switching
 *
 * Model/thinking policy lives in ~/.pi/agent/personas.yaml.
 * Persona prompts, tools, and descriptions live in markdown frontmatter/body.
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

type PersonaPolicies = Record<string, PersonaPolicy>;

interface PersonaPolicy {
	model?: string;
	thinking?: string;
}

interface ProfileConfig {
	description: string;
	default?: boolean;
	personas: PersonaPolicies;
}

interface ProfilesConfig {
	activeProfile?: string;
	defaultProfile?: string;
	defaultPersona?: string;
	profiles: Record<string, ProfileConfig>;
}

interface MarkdownPersona {
	path: string;
	description: string;
	prompt: string;
	tools?: string[];
}

interface ActiveState {
	persona: string;
	profile: string;
	description: string;
	prompt: string;
	markdownPath?: string;
	tools?: string[];
	thinking?: string;
	model?: string;
}

type JsonRecord = Record<string, unknown>;

const THINKING_SUFFIXES = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

// ── Minimal YAML / frontmatter parsing ─────────────────────────────────

function stripInlineComment(value: string): string {
	let quote: string | null = null;
	for (let i = 0; i < value.length; i++) {
		const ch = value[i];
		if (quote) {
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			continue;
		}
		if (ch === "#" && (i === 0 || /\s/.test(value[i - 1] || ""))) {
			return value.slice(0, i).trimEnd();
		}
	}
	return value.trimEnd();
}

function parseScalar(raw: string): string {
	let value = stripInlineComment(raw.trim()).trim();
	if (value.length >= 2 && ((value[0] === '"' && value[value.length - 1] === '"') || (value[0] === "'" && value[value.length - 1] === "'"))) {
		value = value.slice(1, -1);
	}
	return value;
}

function parseBoolean(value: string): boolean | undefined {
	const normalized = value.toLowerCase();
	if (["true", "yes", "on"].includes(normalized)) return true;
	if (["false", "no", "off"].includes(normalized)) return false;
	return undefined;
}

function ensureProfile(config: ProfilesConfig, name: string): ProfileConfig {
	config.profiles[name] = config.profiles[name] || { description: "", personas: {} };
	config.profiles[name].personas = config.profiles[name].personas || {};
	return config.profiles[name];
}

function parseProfilesYaml(raw: string): ProfilesConfig {
	const config: ProfilesConfig = { defaultPersona: "orchestrator", profiles: {} };
	let section: "profiles" | null = null;
	let profileName: string | null = null;
	let personaName: string | null = null;
	let inPersonas = false;

	for (const line of raw.split("\n")) {
		if (!line.trim() || line.trim().startsWith("#")) continue;

		const indent = line.search(/\S/);
		const trimmed = line.trim();
		const colon = trimmed.indexOf(":");
		if (colon === -1) continue;

		const key = trimmed.slice(0, colon).trim();
		const value = parseScalar(trimmed.slice(colon + 1));

		if (indent === 0) {
			profileName = null;
			personaName = null;
			inPersonas = false;

			if (key === "profiles") {
				section = "profiles";
			} else if (key === "active_profile" || key === "activeProfile" || key === "active") {
				section = null;
				config.activeProfile = value;
			} else if (key === "default_profile" || key === "defaultProfile") {
				section = null;
				config.defaultProfile = value;
			} else if (key === "default_persona" || key === "defaultPersona") {
				section = null;
				config.defaultPersona = value || "orchestrator";
			} else {
				section = null;
			}
			continue;
		}

		if (section !== "profiles") continue;

		if (indent <= 2) {
			profileName = key;
			personaName = null;
			inPersonas = false;
			ensureProfile(config, key);
			continue;
		}

		if (!profileName) continue;
		const profile = ensureProfile(config, profileName);

		if (indent <= 4) {
			personaName = null;
			if (key === "personas") {
				inPersonas = true;
			} else {
				inPersonas = false;
				if (key === "description") profile.description = value;
				if (key === "default") profile.default = parseBoolean(value);
			}
			continue;
		}

		if (!inPersonas) continue;

		if (indent <= 6) {
			personaName = key;
			profile.personas[personaName] = profile.personas[personaName] || {};
			continue;
		}

		if (indent <= 8 && personaName) {
			const policy = profile.personas[personaName] || {};
			if (key === "model") policy.model = value;
			if (key === "thinking") policy.thinking = value;
			profile.personas[personaName] = policy;
		}
	}

	return config;
}

function mergeProfilesConfig(base: ProfilesConfig, override: ProfilesConfig) {
	if (override.activeProfile) base.activeProfile = override.activeProfile;
	if (override.defaultProfile) base.defaultProfile = override.defaultProfile;
	if (override.defaultPersona) base.defaultPersona = override.defaultPersona;

	for (const [name, profile] of Object.entries(override.profiles)) {
		const target = ensureProfile(base, name);
		if (profile.description) target.description = profile.description;
		if (profile.default !== undefined) target.default = profile.default;
		Object.assign(target.personas, profile.personas);
	}
}

function parseFrontmatter(raw: string): { fields: Record<string, string>; body: string } {
	const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
	if (!match) return { fields: {}, body: raw };

	const fields: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		if (!line.trim() || line.trim().startsWith("#")) continue;
		const colon = line.indexOf(":");
		if (colon === -1) continue;
		const key = line.slice(0, colon).trim();
		fields[key] = parseScalar(line.slice(colon + 1));
	}

	return { fields, body: raw.slice(match[0].length) };
}

function splitCsv(value?: string): string[] | undefined {
	if (!value) return undefined;
	const items = value.split(",").map((item) => item.trim()).filter(Boolean);
	return items.length > 0 ? items : undefined;
}

// ── Persona markdown resolution ───────────────────────────────────────

function providerFromModelSpec(model?: string): string | undefined {
	if (!model) return undefined;
	const slash = model.indexOf("/");
	if (slash <= 0) return undefined;
	return model.slice(0, slash);
}

function orchestratorPromptPath(provider: string | undefined, configDir: string, modelId?: string): string {
	const normalized = provider || "";
	if (modelId?.includes("glm")) {
		const glmPath = join(configDir, "personas", "orchestrator", "glm.md");
		if (existsSync(glmPath)) return glmPath;
	}
	if (normalized === "opencode-go" || normalized.startsWith("anthropic")) {
		if (modelId?.includes("kimi")) {
			const kimiPath = join(configDir, "personas", "orchestrator", "kimi.md");
			if (existsSync(kimiPath)) return kimiPath;
		}
		return join(configDir, "personas", "orchestrator", "claude.md");
	}
	if (normalized.startsWith("google") || normalized.includes("gemini")) {
		const geminiPath = join(configDir, "personas", "orchestrator", "gemini.md");
		if (existsSync(geminiPath)) return geminiPath;
	}
	return join(configDir, "personas", "orchestrator", "gpt.md");
}

function loadMarkdownPersona(name: string, policy: PersonaPolicy | undefined, ctx: ExtensionContext | undefined, configDir: string): MarkdownPersona | undefined {
	const provider = providerFromModelSpec(policy?.model) || ctx?.model?.provider;
	const modelId = policy?.model?.split("/")?.pop() || ctx?.model?.id;
	const path = name === "orchestrator"
		? orchestratorPromptPath(provider, configDir, modelId)
		: join(configDir, "agents", `${name}.md`);

	if (!existsSync(path)) return undefined;

	const raw = readFileSync(path, "utf-8");
	const parsed = parseFrontmatter(raw);
	return {
		path,
		description: parsed.fields.description || name,
		prompt: parsed.body.trim(),
		tools: splitCsv(parsed.fields.tools),
	};
}

// ── Extension ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.registerFlag("profile", {
		description: "Initial persona profile (e.g. work, personal)",
		type: "string",
	});

	let configDir: string = join(homedir(), ".pi", "agent");
	let profilesConfig: ProfilesConfig = { defaultPersona: "orchestrator", profiles: {} };
	let currentProfile = "default";
	let active: ActiveState | null = null;
	let defaultTools: string[] = [];
	let defaultModel: { provider: string; id: string } | null = null;
	let defaultThinking = "off";

	// ── Config loading ──────────────────────────

	function ensureFallbackProfile() {
		if (Object.keys(profilesConfig.profiles).length === 0) {
			profilesConfig.profiles.default = {
				description: "Configured model/profile",
				default: true,
				personas: {},
			};
		}
	}

	function chooseProfile(preferred?: string): string {
		ensureFallbackProfile();
		if (preferred && profilesConfig.profiles[preferred]) return preferred;
		if (profilesConfig.activeProfile && profilesConfig.profiles[profilesConfig.activeProfile]) return profilesConfig.activeProfile;
		if (profilesConfig.defaultProfile && profilesConfig.profiles[profilesConfig.defaultProfile]) return profilesConfig.defaultProfile;
		const markedDefault = Object.entries(profilesConfig.profiles).find(([, profile]) => profile.default)?.[0];
		return markedDefault || Object.keys(profilesConfig.profiles)[0] || "default";
	}

	function reload(cwd?: string, preferredProfile?: string) {
		profilesConfig = { defaultPersona: "orchestrator", profiles: {} };

		const globalPath = join(configDir, "personas.yaml");
		if (existsSync(globalPath)) {
			try {
				profilesConfig = parseProfilesYaml(readFileSync(globalPath, "utf-8"));
			} catch {}
		}

		if (cwd) {
			const projectPath = join(cwd, ".pi", "personas.yaml");
			if (existsSync(projectPath)) {
				try {
					mergeProfilesConfig(profilesConfig, parseProfilesYaml(readFileSync(projectPath, "utf-8")));
				} catch {}
			}
		}

		currentProfile = chooseProfile(preferredProfile);
	}

	// ── Persona/profile resolution ──────────────

	function policyFor(name: string, profileName = currentProfile): PersonaPolicy | undefined {
		return profilesConfig.profiles[profileName]?.personas[name];
	}

	function allPersonaNames(): string[] {
		const names = new Set<string>(["default"]);
		for (const profile of Object.values(profilesConfig.profiles)) {
			for (const name of Object.keys(profile.personas)) names.add(name);
		}
		names.add(profilesConfig.defaultPersona || "orchestrator");
		return [...names].sort((a, b) => {
			if (a === "default") return -1;
			if (b === "default") return 1;
			return a.localeCompare(b);
		});
	}

	function describePersona(name: string, profileName = currentProfile, ctx?: ExtensionContext): string {
		if (name === "default") return "Normal pi — all tools, your configured model";
		const md = loadMarkdownPersona(name, policyFor(name, profileName), ctx, configDir);
		return md?.description || name;
	}

	function resolve(name: string, profileName = currentProfile, ctx?: ExtensionContext): ActiveState | null {
		if (name === "default") {
			return {
				persona: "default",
				profile: profileName,
				description: describePersona("default"),
				prompt: "",
			};
		}

		if (!profilesConfig.profiles[profileName]) return null;

		const policy = policyFor(name, profileName);
		const md = loadMarkdownPersona(name, policy, ctx, configDir);
		if (!policy && !md) return null;

		return {
			persona: name,
			profile: profileName,
			description: md?.description || name,
			prompt: md?.prompt || "",
			markdownPath: md?.path,
			tools: md?.tools,
			thinking: policy?.thinking,
			model: policy?.model,
		};
	}

	function parsePersonaArg(args: string): { name: string; profile?: string } {
		const trimmed = args.trim();
		const colon = trimmed.indexOf(":");
		if (colon === -1) return { name: trimmed };
		return {
			name: trimmed.slice(0, colon).trim(),
			profile: trimmed.slice(colon + 1).trim() || undefined,
		};
	}

	function statusLabel(state: ActiveState): string {
		return state.persona === "default" ? "default" : `${state.persona} (${state.profile})`;
	}

	function policySummary(policy: PersonaPolicy | undefined): string {
		const model = policy?.model || "session model";
		if (!policy?.thinking) return model;

		const colon = model.lastIndexOf(":");
		if (colon > 0 && THINKING_SUFFIXES.has(model.slice(colon + 1))) return model;
		return `${model}:${policy.thinking}`;
	}

	function defaultSessionSummary(): string {
		if (!defaultModel) return defaultThinking && defaultThinking !== "off" ? `session model:${defaultThinking}` : "session model";
		const model = `${defaultModel.provider}/${defaultModel.id}`;
		return defaultThinking && defaultThinking !== "off" ? `${model}:${defaultThinking}` : model;
	}

	function personaSummary(name: string, profileName = currentProfile): string {
		if (name === "default") return defaultSessionSummary();
		return policySummary(policyFor(name, profileName));
	}

	function isActivePersona(name: string, profileName = currentProfile): boolean {
		if (name === "default") return !active && profileName === currentProfile;
		return active?.persona === name && active.profile === profileName;
	}

	function compactPersonaLabel(name: string, profileName = currentProfile, labelName = name): string {
		const marker = isActivePersona(name, profileName) ? "● " : "";
		const profile = labelName === name ? `[${profileName}]` : "";
		return [`${marker}${labelName}`, profile, personaSummary(name, profileName)].filter(Boolean).join("  ");
	}

	function isDefaultProfile(name: string): boolean {
		return profilesConfig.defaultProfile === name || profilesConfig.profiles[name]?.default === true;
	}

	function profileSummary(profileName: string): string {
		const defaultPersona = profilesConfig.defaultPersona || "orchestrator";
		const policies = profilesConfig.profiles[profileName]?.personas;
		const policy = policies?.[defaultPersona] || (policies ? Object.values(policies)[0] : undefined);
		return policySummary(policy);
	}

	function compactProfileLabel(name: string): string {
		const marker = name === currentProfile ? "● " : "";
		const defaultMarker = isDefaultProfile(name) ? "(default)" : "";
		return [`${marker}${name}`, defaultMarker, profileSummary(name)].filter(Boolean).join("  ");
	}

	function updateStatus(ctx: ExtensionContext) {
		if (!ctx.hasUI) return;
		ctx.ui.setStatus("profile", `Profile: ${currentProfile}`);
		ctx.ui.setStatus("persona", active ? `Persona: ${statusLabel(active)}` : "");
	}

	function notify(ctx: ExtensionContext, message: string, type: "info" | "warning" | "error" = "info") {
		if (ctx.hasUI) ctx.ui.notify(message, type);
	}

	async function applyModel(modelSpec: string | undefined, ctx: ExtensionContext) {
		const spec = splitModelSpec(modelSpec);
		if (!spec) {
			if (defaultModel) await restoreDefaultModel(ctx);
			return;
		}

		const model = ctx.modelRegistry.find(spec.provider, spec.id);
		if (!model) {
			notify(ctx, `Model not found: ${modelSpec}`, "warning");
			return;
		}

		const ok = await pi.setModel(model);
		if (!ok) notify(ctx, `No API key for ${modelSpec}`, "warning");
	}

	async function restoreDefaultModel(ctx: ExtensionContext) {
		if (!defaultModel) return;
		const model = ctx.modelRegistry.find(defaultModel.provider, defaultModel.id);
		if (model) await pi.setModel(model);
	}

	function splitModelSpec(modelSpec?: string): { provider: string; id: string } | undefined {
		if (!modelSpec) return undefined;
		const slash = modelSpec.indexOf("/");
		if (slash <= 0) return undefined;
		const provider = modelSpec.slice(0, slash);
		let id = modelSpec.slice(slash + 1);
		const colon = id.lastIndexOf(":");
		if (colon > 0 && THINKING_SUFFIXES.has(id.slice(colon + 1))) {
			id = id.slice(0, colon);
		}
		return { provider, id };
	}

	// ── Switching ───────────────────────────────

	async function switchTo(state: ActiveState, ctx: ExtensionContext) {
		if (state.persona === "default") {
			currentProfile = state.profile;
			active = null;
			pi.setActiveTools(defaultTools);
			await restoreDefaultModel(ctx);
			pi.setThinkingLevel(defaultThinking as any);
			updateStatus(ctx);
			notify(ctx, `Persona: default • Profile: ${currentProfile}`);
			return;
		}

		currentProfile = state.profile;
		active = state;

		if (state.tools) {
			const available = new Set(pi.getAllTools().map((tool) => tool.name));
			const filtered = state.tools.filter((tool) => available.has(tool));
			pi.setActiveTools(filtered);
		} else {
			pi.setActiveTools(defaultTools);
		}

		await applyModel(state.model, ctx);
		pi.setThinkingLevel((state.thinking || defaultThinking) as any);

		updateStatus(ctx);

		const promptLoaded = state.prompt ? `prompt: ${state.prompt.length} chars` : "no prompt file";
		const model = state.model || "session default model";
		const thinking = state.thinking || defaultThinking;
		notify(ctx, `Persona: ${statusLabel(state)} • ${promptLoaded} • ${model} • thinking: ${thinking}`);
	}

	async function switchProfile(profileName: string, ctx: ExtensionContext) {
		if (!profilesConfig.profiles[profileName]) {
			notify(ctx, `Unknown profile: ${profileName}`, "error");
			return;
		}

		currentProfile = profileName;
		if (active) {
			const state = resolve(active.persona, currentProfile, ctx);
			if (state) {
				await switchTo(state, ctx);
				return;
			}
		}

		updateStatus(ctx);
		notify(ctx, `Profile: ${currentProfile}`);
	}

	// ── Subagent model injection ────────────────

	function isRecord(value: unknown): value is JsonRecord {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}

	function hasOwn(record: JsonRecord, key: string): boolean {
		return Object.prototype.hasOwnProperty.call(record, key);
	}

	function modelOverrideForAgent(agentName: string): string | undefined {
		const policy = policyFor(agentName);
		if (!policy?.model) return undefined;
		if (!policy.thinking) return policy.model;

		const slash = policy.model.indexOf("/");
		const id = slash >= 0 ? policy.model.slice(slash + 1) : policy.model;
		if (id.includes(":")) return policy.model;
		return `${policy.model}:${policy.thinking}`;
	}

	function patchTaskModel(task: JsonRecord): boolean {
		if (hasOwn(task, "model")) return false;
		if (typeof task.agent !== "string") return false;
		const override = modelOverrideForAgent(task.agent);
		if (!override) return false;
		task.model = override;
		return true;
	}

	function patchSubagentInput(input: JsonRecord): number {
		if (typeof input.action === "string") return 0;
		let patched = 0;

		if (Array.isArray(input.tasks)) {
			for (const task of input.tasks) {
				if (isRecord(task) && patchTaskModel(task)) patched++;
			}
		}

		if (Array.isArray(input.chain)) {
			for (const step of input.chain) {
				if (!isRecord(step)) continue;
				if (patchTaskModel(step)) patched++;
				if (Array.isArray(step.parallel)) {
					for (const parallelTask of step.parallel) {
						if (isRecord(parallelTask) && patchTaskModel(parallelTask)) patched++;
					}
				}
			}
		}

		if (!Array.isArray(input.tasks) && !Array.isArray(input.chain) && patchTaskModel(input)) {
			patched++;
		}

		return patched;
	}

	// ── Session lifecycle ───────────────────────

	pi.on("session_start", async (_event, ctx) => {
		reload(ctx.cwd, pi.getFlag("profile") as string | undefined);
		defaultTools = pi.getActiveTools();
		defaultModel = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : null;
		defaultThinking = pi.getThinkingLevel();
		active = null;
		updateStatus(ctx);

		const startupPersona = profilesConfig.defaultPersona || "orchestrator";
		const startupState = resolve(startupPersona, currentProfile, ctx);
		if (startupState) await switchTo(startupState, ctx);
	});

	pi.on("before_agent_start", async (event) => {
		if (!active?.prompt) return;
		const projectInstructionsReminder =
			"[CRITICAL REMINDER] The system prompt above includes project-specific instructions from @agent/AGENTS.md and @agent/APPEND_SYSTEM.md. " +
			"You must follow them, especially tool-access rules (e.g., npx mcporter MCP servers), branch naming conventions, and repo workflow requirements. " +
			"Do not claim a capability is unavailable without checking those instructions first.";
		return {
			systemPrompt: active.prompt + "\n\n" + event.systemPrompt + "\n\n" + projectInstructionsReminder,
		};
	});

	pi.on("tool_call", (event) => {
		if (event.toolName !== "subagent") return;
		if (!isRecord(event.input)) return;
		patchSubagentInput(event.input);
	});

	// ── Commands ────────────────────────────────

	pi.registerCommand("persona", {
		description: "Switch persona using the active profile, or /persona <name>:<profile>",
		getArgumentCompletions: (prefix: string) => {
			const items: { value: string; label: string }[] = [];
			const profileNames = Object.keys(profilesConfig.profiles);
			for (const name of allPersonaNames()) {
				items.push({ value: name, label: compactPersonaLabel(name) });
				if (name !== "default") {
					for (const profileName of profileNames) {
						const policy = policyFor(name, profileName);
						if (!policy && !loadMarkdownPersona(name, undefined, undefined, configDir)) continue;
						const value = `${name}:${profileName}`;
						items.push({ value, label: compactPersonaLabel(name, profileName, value) });
					}
				}
			}
			const trimmed = prefix.trim();
			const filtered = items.filter((item) => item.value.startsWith(trimmed));
			return filtered.length > 0 ? filtered : items;
		},
		handler: async (args, ctx) => {
			let name: string;
			let profileName = currentProfile;

			if (args.trim()) {
				const parsed = parsePersonaArg(args);
				name = parsed.name;
				if (parsed.profile) profileName = parsed.profile;
			} else {
				const names = allPersonaNames();
				const options = names.map((personaName) => compactPersonaLabel(personaName, currentProfile));
				const choice = await ctx.ui.select("Select Persona", options);
				if (choice === undefined) return;
				name = names[options.indexOf(choice)];
			}

			if (profileName && !profilesConfig.profiles[profileName]) {
				notify(ctx, `Unknown profile: ${profileName}`, "error");
				return;
			}

			const state = resolve(name, profileName, ctx);
			if (!state) {
				notify(ctx, `Unknown persona: ${name}`, "error");
				return;
			}

			await switchTo(state, ctx);
		},
	});

	pi.registerCommand("profile", {
		description: "Switch active persona profile, or /profile status. Use `pi --profile <name>` to select at startup.",
		getArgumentCompletions: (prefix: string) => {
			const items = [
				{ value: "status", label: "status" },
				...Object.keys(profilesConfig.profiles).map((value) => ({ value, label: compactProfileLabel(value) })),
			];
			const trimmed = prefix.trim();
			return items.filter((item) => item.value.startsWith(trimmed));
		},
		handler: async (args, ctx) => {
			const arg = args.trim();
			if (arg === "status") {
				notify(ctx, profileStatus(ctx), "info");
				return;
			}

			let profileName = arg;
			if (!profileName) {
				const names = Object.keys(profilesConfig.profiles);
				const options = names.map((name) => compactProfileLabel(name));
				const choice = await ctx.ui.select("Select Profile", options);
				if (choice === undefined) return;
				profileName = names[options.indexOf(choice)];
			}

			await switchProfile(profileName, ctx);
		},
	});

	function profileStatus(ctx: ExtensionCommandContext): string {
		const profile = profilesConfig.profiles[currentProfile];
		const lines = [
			`Profile: ${currentProfile}`,
			profile?.description ? `Description: ${profile.description}` : null,
			active ? `Persona: ${active.persona}` : "Persona: default/session",
			active?.model ? `Model: ${active.model}` : null,
			active?.thinking ? `Thinking: ${active.thinking}` : null,
			active?.tools ? `Tools: ${active.tools.join(", ")}` : "Tools: session defaults/all active",
			active?.markdownPath ? `Prompt: ${active.markdownPath}` : active ? "Prompt: none" : null,
			`Available profiles: ${Object.keys(profilesConfig.profiles).join(", ")}`,
		];
		void ctx;
		return lines.filter(Boolean).join("\n");
	}

	pi.registerCommand("persona-reload", {
		description: "Reload persona profiles config from disk",
		handler: async (_args, ctx) => {
			reload(ctx.cwd, currentProfile);
			if (active) {
				const state = resolve(active.persona, currentProfile, ctx);
				if (state) await switchTo(state, ctx);
				return;
			}
			updateStatus(ctx);
			notify(ctx, `Loaded profiles: ${Object.keys(profilesConfig.profiles).join(", ")}`);
		},
	});

	pi.registerCommand("persona-info", {
		description: "Show active persona/profile details",
		handler: async (_args, ctx) => {
			notify(ctx, profileStatus(ctx), "info");
		},
	});
}

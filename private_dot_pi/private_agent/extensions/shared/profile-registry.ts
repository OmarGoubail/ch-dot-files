import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type JsonRecord = Record<string, unknown>;

export type ModelPolicy = {
	model?: string;
	thinking?: ThinkingLevel;
};

export type Profile = ModelPolicy & {
	allowedProviders: string[];
	subagents: Record<string, ModelPolicy>;
};

export type ProfilesFile = {
	activeProfile?: string;
	profiles: Record<string, Profile>;
};

export type ModelSpec = {
	provider: string;
	id: string;
};

export type ProfileLoadResult = {
	config: ProfilesFile;
	warnings: string[];
};

export type ParentProfileState = Record<string, ModelPolicy>;

export const PROFILES_PATH = join(homedir(), ".pi", "agent", "profiles.json");
export const PROFILE_STATE_PATH = join(homedir(), ".pi", "agent", "profile-state.json");
export const PROFILE_SELECTION_ENTRY_TYPE = "profiles.selection";

const THINKING_LEVELS = new Set<ThinkingLevel>([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
]);

export function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asThinking(value: unknown, label: string, warnings: string[]): ThinkingLevel | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string" && THINKING_LEVELS.has(value as ThinkingLevel)) {
		return value as ThinkingLevel;
	}
	warnings.push(`${label} has invalid thinking level ${JSON.stringify(value)}.`);
	return undefined;
}

function asPolicy(value: unknown, label: string, warnings: string[]): ModelPolicy {
	if (!isRecord(value)) {
		warnings.push(`${label} must be a mapping.`);
		return {};
	}

	const policy: ModelPolicy = {};
	if (value.model !== undefined) {
		if (typeof value.model === "string" && value.model.trim()) {
			policy.model = value.model.trim();
		} else {
			warnings.push(`${label}.model must be a non-empty provider/model string.`);
		}
	}
	policy.thinking = asThinking(value.thinking, `${label}.thinking`, warnings);
	return policy;
}

function atomicWriteJson(path: string, value: unknown): boolean {
	const temporary = `${path}.${process.pid}.tmp`;
	try {
		writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
		renameSync(temporary, path);
		return true;
	} catch {
		try { rmSync(temporary, { force: true }); } catch {}
		return false;
	}
}

export function readParentProfileState(path = PROFILE_STATE_PATH): ParentProfileState {
	if (!existsSync(path)) return {};
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		if (!isRecord(parsed)) return {};
		const state: ParentProfileState = {};
		for (const [name, raw] of Object.entries(parsed)) {
			if (!isRecord(raw)) continue;
			const policy: ModelPolicy = {};
			if (typeof raw.model === "string" && raw.model.trim()) policy.model = raw.model.trim();
			if (typeof raw.thinking === "string" && THINKING_LEVELS.has(raw.thinking as ThinkingLevel)) {
				policy.thinking = raw.thinking as ThinkingLevel;
			}
			state[name] = policy;
		}
		return state;
	} catch {
		return {};
	}
}

export function writeParentProfileState(state: ParentProfileState, path = PROFILE_STATE_PATH): boolean {
	return atomicWriteJson(path, state);
}

export function profileSelectionFromEntries(entries: readonly unknown[]): string | undefined {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (!isRecord(entry) || entry.type !== "custom" || entry.customType !== PROFILE_SELECTION_ENTRY_TYPE) continue;
		if (isRecord(entry.data) && typeof entry.data.profile === "string" && entry.data.profile.trim()) {
			return entry.data.profile.trim();
		}
	}
	return undefined;
}

function asAllowedProviders(value: unknown, label: string, warnings: string[]): string[] {
	if (!Array.isArray(value)) {
		warnings.push(`${label} must be a non-empty string array.`);
		return [];
	}
	const providers = [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
	if (providers.length === 0) warnings.push(`${label} must contain at least one provider.`);
	return providers;
}

export function readProfiles(path = PROFILES_PATH): ProfileLoadResult {
	const warnings: string[] = [];
	if (!existsSync(path)) {
		return { config: { profiles: {} }, warnings: [`Missing ${path}.`] };
	}

	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		if (!isRecord(parsed)) {
			return { config: { profiles: {} }, warnings: ["profiles.json must contain an object."] };
		}

		const profiles: Record<string, Profile> = {};
		if (!isRecord(parsed.profiles)) {
			warnings.push("profiles must be a mapping.");
		} else {
			for (const [name, rawProfile] of Object.entries(parsed.profiles)) {
				if (!isRecord(rawProfile)) {
					warnings.push(`profiles.${name} must be a mapping.`);
					continue;
				}
				const policy = asPolicy(rawProfile, `profiles.${name}`, warnings);
				const allowedProviders = asAllowedProviders(
					rawProfile.allowed_providers,
					`profiles.${name}.allowed_providers`,
					warnings,
				);
				const subagents: Record<string, ModelPolicy> = {};
				if (!isRecord(rawProfile.subagents)) {
					warnings.push(`profiles.${name}.subagents must be a mapping.`);
				} else {
					for (const [role, rawPolicy] of Object.entries(rawProfile.subagents)) {
						subagents[role] = asPolicy(rawPolicy, `profiles.${name}.subagents.${role}`, warnings);
					}
				}
				profiles[name] = { ...policy, allowedProviders, subagents };
			}
		}

		const activeProfile = typeof parsed.active_profile === "string" && parsed.active_profile.trim()
			? parsed.active_profile.trim()
			: undefined;
		if (parsed.active_profile !== undefined && !activeProfile) {
			warnings.push("active_profile must be a non-empty profile name.");
		}
		if (activeProfile && !profiles[activeProfile]) {
			warnings.push(`active_profile '${activeProfile}' does not exist.`);
		}
		return { config: { activeProfile, profiles }, warnings };
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		return { config: { profiles: {} }, warnings: [`Could not read ${path}: ${detail}`] };
	}
}

export function parseModelSpec(value: string): ModelSpec | undefined {
	const slash = value.indexOf("/");
	if (slash <= 0 || slash === value.length - 1) return undefined;
	const provider = value.slice(0, slash);
	let id = value.slice(slash + 1);
	const colon = id.lastIndexOf(":");
	if (colon > 0 && THINKING_LEVELS.has(id.slice(colon + 1) as ThinkingLevel)) {
		id = id.slice(0, colon);
	}
	return id ? { provider, id } : undefined;
}

export function modelPolicyError(profileName: string, profile: Profile, policy: ModelPolicy, label: string): string | undefined {
	if (!policy.model) return `${label} in profile '${profileName}' has no model.`;
	const spec = parseModelSpec(policy.model);
	if (!spec) return `${label} model '${policy.model}' is invalid; expected provider/model.`;
	if (!profile.allowedProviders.includes(spec.provider)) {
		return `${label} model '${policy.model}' is forbidden by profile '${profileName}'. Allowed providers: ${profile.allowedProviders.join(", ") || "none"}.`;
	}
	return undefined;
}

export class ProfileRegistry {
	private selected?: string;
	private result: ProfileLoadResult = { config: { profiles: {} }, warnings: [] };
	private readonly path: string;

	constructor(path = PROFILES_PATH) {
		this.path = path;
	}

	reload(options: { preferred?: string; preserveSelection?: boolean } = {}): ProfileLoadResult {
		this.result = readProfiles(this.path);
		const profiles = this.result.config.profiles;
		const preferred = options.preferred && profiles[options.preferred] ? options.preferred : undefined;
		const preserved = options.preserveSelection && this.selected && profiles[this.selected] ? this.selected : undefined;
		const configured = this.result.config.activeProfile && profiles[this.result.config.activeProfile]
			? this.result.config.activeProfile
			: undefined;
		this.selected = preferred ?? preserved ?? configured ?? Object.keys(profiles).sort()[0];
		return this.result;
	}

	select(name: string): boolean {
		if (!this.result.config.profiles[name]) return false;
		this.selected = name;
		return true;
	}

	selectedName(): string | undefined {
		return this.selected;
	}

	profile(name = this.selected): Profile | undefined {
		return name ? this.result.config.profiles[name] : undefined;
	}

	profileNames(): string[] {
		return Object.keys(this.result.config.profiles).sort((a, b) => a.localeCompare(b));
	}

	warnings(): string[] {
		return [...this.result.warnings];
	}

	resolveParent(profileName = this.selected): { profileName: string; profile: Profile; policy: ModelPolicy } | undefined {
		const profile = this.profile(profileName);
		return profile && profileName ? { profileName, profile, policy: profile } : undefined;
	}

	resolveSubagent(role: string, profileName = this.selected): { profileName: string; profile: Profile; policy: ModelPolicy } | undefined {
		const profile = this.profile(profileName);
		const policy = profile?.subagents[role];
		return profile && policy && profileName ? { profileName, profile, policy } : undefined;
	}
}

const sharedRegistry = new ProfileRegistry();

export function getProfileRegistry(): ProfileRegistry {
	return sharedRegistry;
}

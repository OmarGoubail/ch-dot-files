/**
 * Baseten provider extension for pi.
 *
 * Registers Baseten's OpenAI-compatible Model API.
 * Set BASETEN_API_KEY in ~/.pi/agent/auth.json or as an env var.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "baseten";
const BASE_URL = "https://inference.baseten.co/v1";
const MODELS_URL = `${BASE_URL}/models`;

interface BasetenModel {
	id: string;
	name: string;
	reasoning: boolean;
	input: ("text" | "image")[];
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	};
	contextWindow: number;
	maxTokens: number;
	compat?: Record<string, unknown>;
	thinkingLevelMap?: Record<string, string | null>;
}

// Curated fallback model list. Update this when Baseten adds/changes models.
const STATIC_MODELS: BasetenModel[] = [
	{
		id: "deepseek-ai/DeepSeek-V4-Pro",
		name: "DeepSeek V4 Pro",
		reasoning: true,
		input: ["text"],
		cost: { input: 1.74, output: 3.48, cacheRead: 0.15, cacheWrite: 0 },
		contextWindow: 131000,
		maxTokens: 131000,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "openai",
		},
	},
	{
		id: "zai-org/GLM-4.7",
		name: "GLM 4.7",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.6, output: 2.2, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200000,
		maxTokens: 200000,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "qwen-chat-template",
		},
	},
	{
		id: "zai-org/GLM-5",
		name: "GLM 5",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.95, output: 3.15, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 202800,
		maxTokens: 202800,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "qwen-chat-template",
		},
	},
	{
		id: "zai-org/GLM-5.1",
		name: "GLM 5.1",
		reasoning: false,
		input: ["text"],
		cost: { input: 1.3, output: 4.3, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 202800,
		maxTokens: 202800,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
		},
	},
	{
		id: "zai-org/GLM-5.2",
		name: "GLM 5.2",
		reasoning: true,
		input: ["text"],
		cost: { input: 1.4, output: 4.4, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 202720,
		maxTokens: 202720,
		thinkingLevelMap: {
			minimal: "minimal",
			low: "low",
			medium: "medium",
			high: "high",
			xhigh: "max",
		},
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "qwen-chat-template",
		},
	},
	{
		id: "moonshotai/Kimi-K2.5",
		name: "Kimi K2.5",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0.6, output: 3.0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 262000,
		maxTokens: 262000,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "qwen-chat-template",
		},
	},
	{
		id: "moonshotai/Kimi-K2.6",
		name: "Kimi K2.6",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0.6, output: 3.0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 262000,
		maxTokens: 262000,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "qwen-chat-template",
		},
	},
	{
		id: "moonshotai/Kimi-K2.7-Code",
		name: "Kimi K2.7 Code",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.95, output: 4.0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 262000,
		maxTokens: 262000,
		thinkingLevelMap: {
			minimal: null,
			low: "low",
			medium: "medium",
			high: "high",
			xhigh: null,
		},
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "openai",
		},
	},
	{
		id: "nvidia/Nemotron-120B-A12B",
		name: "Nemotron Super",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.3, output: 0.75, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 202800,
		maxTokens: 202800,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "openai",
		},
	},
	{
		id: "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B",
		name: "Nemotron Ultra",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.6, output: 2.4, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 202800,
		maxTokens: 202800,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "openai",
		},
	},
	{
		id: "openai/gpt-oss-120b",
		name: "OpenAI GPT 120B",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.1, output: 0.5, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128072,
		maxTokens: 128072,
		compat: {
			supportsDeveloperRole: true,
			supportsStore: false,
			maxTokensField: "max_completion_tokens",
			thinkingFormat: "openai",
			supportsReasoningEffort: true,
		},
	},
];

function toPerMillion(val: unknown): number {
	if (val === "" || val === null || val === undefined) return 0;
	const n = typeof val === "string" ? parseFloat(val) : Number(val);
	return Number.isFinite(n) ? n * 1_000_000 : 0;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function transformApiModel(apiModel: unknown): BasetenModel | null {
	if (!apiModel || typeof apiModel !== "object") return null;
	const m = apiModel as Record<string, unknown>;

	const id = typeof m.id === "string" ? m.id : "";
	if (!id) return null;

	const features = isStringArray(m.supported_features) ? m.supported_features : [];
	const inputModalities = isStringArray(m.input_modalities) ? m.input_modalities : [];
	const pricing = (m.pricing && typeof m.pricing === "object" ? m.pricing : {}) as Record<string, unknown>;

	const hasReasoning = features.includes("reasoning");
	const hasVision = inputModalities.includes("image");
	const supportsReasoningEffort = features.includes("reasoning_effort");

	const model: BasetenModel = {
		id,
		name: typeof m.name === "string" && m.name ? m.name : id,
		reasoning: hasReasoning,
		input: hasVision ? ["text", "image"] : ["text"],
		cost: {
			input: toPerMillion(pricing.prompt),
			output: toPerMillion(pricing.completion),
			cacheRead: toPerMillion(pricing.cache_prompt),
			cacheWrite: 0,
		},
		contextWindow: typeof m.context_length === "number" ? m.context_length : 131072,
		maxTokens: typeof m.max_completion_tokens === "number" ? m.max_completion_tokens : 131072,
	};

	const compat: NonNullable<BasetenModel["compat"]> = {
		supportsDeveloperRole: true,
		supportsStore: false,
		maxTokensField: "max_completion_tokens",
	};

	if (hasReasoning) compat.thinkingFormat = "openai";
	if (supportsReasoningEffort) compat.supportsReasoningEffort = true;
	model.compat = compat;

	return model;
}

async function fetchLiveModels(apiKey: string): Promise<BasetenModel[] | null> {
	try {
		const response = await fetch(MODELS_URL, {
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(10000),
		});
		if (!response.ok) {
			console.error(`[${PROVIDER_ID}] /v1/models returned ${response.status}`);
			return null;
		}
		const data = (await response.json()) as unknown;
		const apiModels = Array.isArray(data)
			? data
			: data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).data)
				? (data as Record<string, unknown>).data
				: [];
		if (!Array.isArray(apiModels) || apiModels.length === 0) return null;
		return apiModels.map(transformApiModel).filter((m): m is BasetenModel => m !== null);
	} catch (err) {
		console.error(`[${PROVIDER_ID}] failed to fetch live models:`, err);
		return null;
	}
}

function mergeWithStatic(liveModels: BasetenModel[]): BasetenModel[] {
	const staticMap = new Map(STATIC_MODELS.map((m) => [m.id, m]));
	const seen = new Set<string>();
	const result: BasetenModel[] = [];

	for (const live of liveModels) {
		seen.add(live.id);
		const curated = staticMap.get(live.id);
		if (curated) {
			result.push({
				...curated,
				contextWindow: live.contextWindow || curated.contextWindow,
				maxTokens: live.maxTokens || curated.maxTokens,
			});
		} else {
			result.push(live);
		}
	}

	for (const curated of STATIC_MODELS) {
		if (!seen.has(curated.id)) result.push(curated);
	}

	return result;
}

function registerModels(pi: ExtensionAPI, models: BasetenModel[]) {
	pi.registerProvider(PROVIDER_ID, {
		name: "Baseten",
		baseUrl: BASE_URL,
		apiKey: "$BASETEN_API_KEY",
		api: "openai-completions",
		authHeader: true,
		models: models.map((m) => ({
			id: m.id,
			name: m.name,
			reasoning: m.reasoning,
			input: m.input,
			cost: m.cost,
			contextWindow: m.contextWindow,
			maxTokens: m.maxTokens,
			compat: m.compat,
			thinkingLevelMap: m.thinkingLevelMap,
		})),
	});
}

export default function (pi: ExtensionAPI) {
	// Register the curated static list immediately so the TUI model picker
	// sees Baseten models before any network call finishes.
	registerModels(pi, STATIC_MODELS);

	// Refresh from Baseten's live API on session start using the resolved key
	// (supports auth.json, env vars, and CLI --api-key).
	pi.on("session_start", async (_event, ctx) => {
		const apiKey = await ctx.modelRegistry.getApiKeyForProvider(PROVIDER_ID).catch(() => undefined);
		if (!apiKey) return;
		const live = await fetchLiveModels(apiKey);
		if (live && live.length > 0) {
			registerModels(pi, mergeWithStatic(live));
		}
	});

	// Also try to refresh immediately if the key is available via env var.
	const envKey = process.env.BASETEN_API_KEY;
	if (envKey) {
		fetchLiveModels(envKey).then((live) => {
			if (live && live.length > 0) {
				registerModels(pi, mergeWithStatic(live));
			}
		});
	}
}

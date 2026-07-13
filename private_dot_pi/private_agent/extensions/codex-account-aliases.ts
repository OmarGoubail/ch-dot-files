import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getModels } from "@mariozechner/pi-ai";
import { openaiCodexOAuthProvider } from "@mariozechner/pi-ai/oauth";

const SOURCE_PROVIDER = "openai-codex";
const API = "openai-codex-responses" as const;

const ALIASES = [
	{ provider: "openai-codex-work", name: "OpenAI Codex (work)" },
	{ provider: "openai-codex-personal", name: "OpenAI Codex (personal)" },
];

// Extra models not yet in pi's built-in registry. These get merged into
// the built-in source models so they appear under all codex provider aliases.
// Remove entries from this array once pi ships them built-in.
const EXTRA_MODELS = [
	{
		id: "codex-auto-review",
		name: "Codex Auto Review",
		reasoning: true,
		thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
];

export default function (pi: ExtensionAPI) {
	const sourceModels = getModels(SOURCE_PROVIDER);
	const defaultBaseUrl = sourceModels[0]?.baseUrl;
	if (!defaultBaseUrl || sourceModels.length === 0) return;

	// Merge extra models into the source list so they get cloned to all aliases.
	const existingIds = new Set(sourceModels.map((m) => m.id));
	const allModels = [
		...sourceModels,
		...EXTRA_MODELS.filter((m) => !existingIds.has(m.id)).map((m) => ({
			...m,
			api: API,
			baseUrl: defaultBaseUrl,
		})),
	];

	for (const alias of ALIASES) {
		pi.registerProvider(alias.provider, {
			name: alias.name,
			baseUrl: defaultBaseUrl,
			api: API,
			oauth: {
				name: alias.name,
				usesCallbackServer: openaiCodexOAuthProvider.usesCallbackServer,
				login: openaiCodexOAuthProvider.login,
				refreshToken: openaiCodexOAuthProvider.refreshToken,
				getApiKey: openaiCodexOAuthProvider.getApiKey,
			} as any,
			models: allModels.map((model) => ({
				id: model.id,
				name: model.name || model.id,
				api: API,
				baseUrl: model.baseUrl,
				reasoning: model.reasoning,
				thinkingLevelMap: model.thinkingLevelMap,
				input: model.input,
				cost: model.cost,
				contextWindow: model.contextWindow,
				maxTokens: model.maxTokens,
				compat: model.compat,
			})),
		});
	}
}

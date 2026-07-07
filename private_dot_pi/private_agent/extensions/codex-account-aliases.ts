import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getModels } from "@mariozechner/pi-ai";
import { openaiCodexOAuthProvider } from "@mariozechner/pi-ai/oauth";

const SOURCE_PROVIDER = "openai-codex";
const API = "openai-codex-responses" as const;

const ALIASES = [
	{ provider: "openai-codex-work", name: "OpenAI Codex (work)" },
	{ provider: "openai-codex-personal", name: "OpenAI Codex (personal)" },
];

export default function (pi: ExtensionAPI) {
	const sourceModels = getModels(SOURCE_PROVIDER);
	const defaultBaseUrl = sourceModels[0]?.baseUrl;
	if (!defaultBaseUrl || sourceModels.length === 0) return;

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
			models: sourceModels.map((model) => ({
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

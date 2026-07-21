import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type {
	AuthInteraction,
	OAuthAuth,
	OAuthCredential,
	OAuthLoginCallbacks,
} from "@earendil-works/pi-ai";
import { getModels } from "@earendil-works/pi-ai/compat";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";

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

function adaptCodexOAuth(oauth: OAuthAuth, name: string) {
	return {
		name,
		login: async (callbacks: OAuthLoginCallbacks) => {
			const interaction: AuthInteraction = {
				signal: callbacks.signal,
				notify(event) {
					switch (event.type) {
						case "auth_url":
							callbacks.onAuth(event);
							break;
						case "device_code":
							callbacks.onDeviceCode(event);
							break;
						case "progress":
							callbacks.onProgress?.(event.message);
							break;
						case "info":
							callbacks.onProgress?.(event.message);
							break;
					}
				},
				prompt: async (prompt) => {
					if (prompt.type === "select") {
						const selected = await callbacks.onSelect({
							message: prompt.message,
							options: prompt.options.map(({ id, label }) => ({ id, label })),
						});
						if (!selected) throw new Error("Login cancelled");
						return selected;
					}

					if (prompt.type === "manual_code" && callbacks.onManualCodeInput) {
						return callbacks.onManualCodeInput();
					}

					return callbacks.onPrompt({
						message: prompt.message,
						placeholder: prompt.placeholder,
					});
				},
			};

			return oauth.login(interaction);
		},
		refreshToken: async (credentials: OAuthCredential) =>
			oauth.refresh({ ...credentials, type: "oauth" }),
		getApiKey: (credentials: OAuthCredential) => credentials.access,
	};
}

export default function (pi: ExtensionAPI) {
	const sourceModels = getModels(SOURCE_PROVIDER);
	const sourceProvider = builtinProviders().find((provider) => provider.id === SOURCE_PROVIDER);
	const codexOAuth = sourceProvider?.auth.oauth;
	const defaultBaseUrl = sourceModels[0]?.baseUrl;
	if (!defaultBaseUrl || sourceModels.length === 0 || !codexOAuth) return;

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
			oauth: adaptCodexOAuth(codexOAuth, alias.name) as any,
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

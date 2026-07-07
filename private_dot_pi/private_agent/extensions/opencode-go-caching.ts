/**
 * Local copy of pi-opencode-go-cache, audited and vendored as a single file.
 *
 * What this does:
 *   - Hooks Pi's `before_provider_request` event for the `opencode-go` provider only.
 *   - Adds proper prompt caching knobs that Pi does not set by default:
 *       * `prompt_cache_key` scoped to the current Pi session
 *       * `prompt_cache_retention: "24h"`
 *       * Anthropic-style `cache_control` breakpoints on system messages,
 *         the last two user/assistant messages, and the last tool definition.
 *   - Skips GLM/Zhipu models because the OpenCode Go gateway currently does NOT
 *     strip `cache_control` markers for them and their upstream API rejects the
 *     request ("Extra inputs are not permitted, field: ...cache_control").
 *
 * Security audit:
 *   - No network requests, no file system access, no shell execution.
 *   - Only mutates the outgoing LLM request payload with cache metadata.
 *   - The session id is used only as a local cache key; it is never sent elsewhere.
 *   - Wrapped in try/catch so a bug here cannot break an LLM call.
 *
 * Install: this file is automatically discovered by Pi because it lives in
 * `~/.pi/agent/extensions/`. Run `/reload` in Pi or restart Pi to load it.
 *
 * Original source: https://github.com/nnocte/pi-opencode-go-cache
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "opencode-go";
const MAX_PROMPT_CACHE_KEY_LEN = 64;

const CACHE_CONTROL_EPHEMERAL = Object.freeze({ type: "ephemeral", ttl: "1h" });

function clampPromptCacheKey(key: string | undefined): string | undefined {
    if (!key) return undefined;
    if (key.length <= MAX_PROMPT_CACHE_KEY_LEN) return key;
    return Array.from(key).slice(0, MAX_PROMPT_CACHE_KEY_LEN).join("");
}

function isOpencodeGoModel(model: { provider?: string } | undefined): boolean {
    if (!model) return false;
    return model.provider === PROVIDER_ID;
}

const UNSUPPORTED_CACHE_MODEL_PATTERNS: readonly string[] = ["glm", "zhipu"];

function isUnsupportedForCache(model: { id?: string } | undefined): boolean {
    if (!model) return false;
    const id = (model.id ?? "").toLowerCase();
    return UNSUPPORTED_CACHE_MODEL_PATTERNS.some((p) => id.includes(p));
}

function stampCacheControlOnMessage(
    message: Record<string, unknown>,
    marker: Record<string, unknown>,
): boolean {
    const content = message.content;
    if (typeof content === "string") {
        if (content.length === 0) return false;
        message.content = [{ type: "text", text: content, cache_control: marker }];
        return true;
    }
    if (Array.isArray(content) && content.length > 0) {
        for (let i = content.length - 1; i >= 0; i--) {
            const part = content[i] as Record<string, unknown>;
            if (!part || typeof part !== "object") continue;
            if (part.cache_control) return true;
            if (
                part.type === "text" ||
                part.type === "image" ||
                part.type === "image_url" ||
                part.type === "tool_use" ||
                part.type === "tool_result"
            ) {
                part.cache_control = marker;
                return true;
            }
        }
    }
    return false;
}

function applyConversationCacheBreakpoints(
    messages: Array<Record<string, unknown>>,
    marker: Record<string, unknown>,
): void {
    let systemStamped = 0;
    for (const msg of messages) {
        const role = msg.role;
        if (role === "system" || role === "developer") {
            if (stampCacheControlOnMessage(msg, marker)) {
                systemStamped += 1;
                if (systemStamped >= 2) break;
            }
        } else {
            break;
        }
    }

    let finalStamped = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const role = msg.role;
        if (role === "user" || role === "assistant") {
            if (stampCacheControlOnMessage(msg, marker)) {
                finalStamped += 1;
                if (finalStamped >= 2) break;
            }
        }
    }
}

function applyOpenAICompletionsCacheControl(
    payload: Record<string, unknown>,
    marker: Record<string, unknown>,
): void {
    const messages = payload.messages;
    if (Array.isArray(messages) && messages.length > 0) {
        applyConversationCacheBreakpoints(
            messages as Array<Record<string, unknown>>,
            marker,
        );
    }

    const tools = payload.tools;
    if (Array.isArray(tools) && tools.length > 0) {
        const lastTool = tools[tools.length - 1] as Record<string, unknown>;
        if (lastTool && typeof lastTool === "object") {
            lastTool.cache_control = marker;
        }
    }
}

function applyAnthropicCacheControl(
    payload: Record<string, unknown>,
    marker: Record<string, unknown>,
): void {
    const system = payload.system;
    if (typeof system === "string") {
        if (system.length > 0) {
            payload.system = [{ type: "text", text: system, cache_control: marker }];
        }
    } else if (Array.isArray(system) && system.length > 0) {
        let stamped = 0;
        for (let i = 0; i < system.length && stamped < 2; i++) {
            const part = system[i] as Record<string, unknown>;
            if (part && part.type === "text") {
                part.cache_control = marker;
                stamped += 1;
            }
        }
    }

    const messages = payload.messages;
    if (Array.isArray(messages) && messages.length > 0) {
        applyConversationCacheBreakpoints(
            messages as Array<Record<string, unknown>>,
            marker,
        );
    }

    const tools = payload.tools;
    if (Array.isArray(tools) && tools.length > 0) {
        const lastTool = tools[tools.length - 1] as Record<string, unknown>;
        if (lastTool && typeof lastTool === "object") {
            lastTool.cache_control = marker;
        }
    }
}

function stripStaleCacheControl(payload: Record<string, unknown>): void {
    const visit = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const item of node) visit(item);
            return;
        }
        const obj = node as Record<string, unknown>;
        if (obj.cache_control && typeof obj.cache_control === "object") {
            const cc = obj.cache_control as Record<string, unknown>;
            if (cc.type === "ephemeral") {
                delete obj.cache_control;
            }
        }
        for (const key of Object.keys(obj)) {
            if (key === "cache_control") continue;
            const val = obj[key];
            if (val && typeof val === "object") visit(val);
        }
    };

    if ("messages" in payload) visit(payload.messages);
    if ("system" in payload) visit(payload.system);
    if ("tools" in payload) visit(payload.tools);
}

export default function (pi: ExtensionAPI): void {
    let lastStatusKey: string | undefined;

    const setStatus = (
        ctx: { ui: { setStatus: (k: string, v: string) => void } },
        key: string,
        value: string,
    ): void => {
        if (lastStatusKey && lastStatusKey !== key) {
            ctx.ui.setStatus(lastStatusKey, "");
        }
        lastStatusKey = key;
        ctx.ui.setStatus(key, value);
    };

    pi.on("model_select", (event, ctx) => {
        if (!ctx.hasUI) return;
        const model = event.model as { provider?: string; id?: string } | undefined;
        if (!isOpencodeGoModel(model)) {
            if (lastStatusKey) {
                ctx.ui.setStatus(lastStatusKey, "");
                lastStatusKey = undefined;
            }
            return;
        }
        if (isUnsupportedForCache(model)) {
            setStatus(ctx, "opencode-go-cache", "opencode-go-cache: unsupported");
            return;
        }
        setStatus(ctx, "opencode-go-cache", "opencode-go-cache: enabled");
    });

    pi.on("before_provider_request", (event, ctx) => {
        try {
            const model = ctx.model as
                | { provider?: string; api?: string; id?: string }
                | undefined;

            if (!isOpencodeGoModel(model)) {
                if (lastStatusKey && ctx.hasUI) {
                    ctx.ui.setStatus(lastStatusKey, "");
                    lastStatusKey = undefined;
                }
                return undefined;
            }

            if (isUnsupportedForCache(model)) {
                if (lastStatusKey && ctx.hasUI) {
                    ctx.ui.setStatus(lastStatusKey, "");
                    lastStatusKey = undefined;
                }
                if (ctx.hasUI) {
                    setStatus(ctx, "opencode-go-cache", "opencode-go-cache: unsupported");
                }
                return undefined;
            }

            const payload = event.payload;
            if (!payload || typeof payload !== "object") return undefined;
            const payloadObj = payload as Record<string, unknown>;
            const api = model?.api;

            const sessionId = ctx.sessionManager.getSessionId();
            const cacheKey = clampPromptCacheKey(sessionId);
            if (cacheKey) {
                payloadObj.prompt_cache_key = cacheKey;
                payloadObj.prompt_cache_retention = "24h";
            }

            stripStaleCacheControl(payloadObj);

            if (api === "openai-completions") {
                applyOpenAICompletionsCacheControl(payloadObj, CACHE_CONTROL_EPHEMERAL);
            } else if (api === "anthropic-messages") {
                applyAnthropicCacheControl(payloadObj, CACHE_CONTROL_EPHEMERAL);
            }

            if (ctx.hasUI) {
                setStatus(ctx, "opencode-go-cache", "opencode-go-cache: enabled");
            }

            return payloadObj;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (ctx.hasUI) {
                ctx.ui.notify(
                    `opencode-go-cache: ${msg} (request sent without caching)`,
                    "warning",
                );
            }
            return undefined;
        }
    });

    pi.on("session_shutdown", (_event, ctx) => {
        if (lastStatusKey && ctx.hasUI) {
            ctx.ui.setStatus(lastStatusKey, "");
            lastStatusKey = undefined;
        }
    });
}

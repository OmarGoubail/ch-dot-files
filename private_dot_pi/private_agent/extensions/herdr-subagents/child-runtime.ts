import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import herdrAgentState from "../herdr-agent-state.ts";
import { loadCommandRules, matchCommandRule } from "../dannote/confirm-actions.ts";
import { messageText } from "./prompt.ts";
import type { AgentStatus, ChildState } from "./types.ts";
import { EMPTY_USAGE } from "./types.ts";

function envInteger(name: string, fallback: number): number {
	const value = Number.parseInt(process.env[name] ?? "", 10);
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

function allowedProviders(): string[] {
	try {
		const parsed = JSON.parse(process.env.HERDR_SUBAGENT_ALLOWED_PROVIDERS ?? "[]") as unknown;
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
	} catch {
		return [];
	}
}

function atomicWrite(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const temporary = `${path}.${process.pid}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
	renameSync(temporary, path);
}

function actualModel(ctx: ExtensionContext): string | undefined {
	return ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
}

function finiteNumber(value: unknown): number {
	const number = Number(value ?? 0);
	return Number.isFinite(number) ? number : 0;
}

function usageFromMessage(message: unknown) {
	const usage = message && typeof message === "object" ? (message as { usage?: any }).usage : undefined;
	return {
		input: finiteNumber(usage?.input),
		output: finiteNumber(usage?.output),
		cacheRead: finiteNumber(usage?.cacheRead),
		cacheWrite: finiteNumber(usage?.cacheWrite),
		cost: finiteNumber(usage?.cost?.total ?? usage?.cost),
	};
}

export default function childRuntime(pi: ExtensionAPI): void {
	herdrAgentState(pi);
	if (process.env.HERDR_SUBAGENT_CHILD !== "1") return;

	const statePath = process.env.HERDR_SUBAGENT_STATE_PATH;
	const promptPath = process.env.HERDR_SUBAGENT_PROMPT_PATH;
	const expectedModel = process.env.HERDR_SUBAGENT_EXPECTED_MODEL ?? "";
	const sessionId = process.env.HERDR_SUBAGENT_SESSION_ID ?? "";
	const maxTurns = envInteger("HERDR_SUBAGENT_MAX_TURNS", 15);
	const providers = allowedProviders();
	let commandRules = loadCommandRules(process.cwd());
	let budgetReached = false;
	let synthesisInjected = false;
	let state: ChildState = {
		version: 1,
		sessionId,
		status: "starting",
		expectedModel,
		latestAssistant: "",
		usage: { ...EMPTY_USAGE },
		maxTurns,
		blockedActions: [],
		updatedAt: new Date().toISOString(),
	};

	const save = () => {
		state.updatedAt = new Date().toISOString();
		if (statePath) atomicWrite(statePath, state);
	};

	const verifyModel = (ctx: ExtensionContext): string | undefined => {
		const actual = actualModel(ctx);
		state.actualModel = actual;
		if (!actual) return "Child has no active model.";
		if (actual !== expectedModel) return `Child model mismatch: expected ${expectedModel}, got ${actual}.`;
		const provider = actual.split("/", 1)[0];
		if (!providers.includes(provider)) {
			return `Child provider '${provider}' is forbidden. Allowed providers: ${providers.join(", ") || "none"}.`;
		}
	};

	const failChild = (ctx: ExtensionContext, error: string) => {
		state.status = "failed";
		state.error = error;
		save();
		ctx.ui.notify(error, "error");
		ctx.abort();
	};

	pi.registerCommand("herdr-delegate", {
		description: "Load and run the parent-owned delegation prompt",
		handler: async (_args, ctx) => {
			if (!promptPath) {
				failChild(ctx, "Child delegation prompt path is missing.");
				return;
			}
			try {
				const prompt = readFileSync(promptPath, "utf8");
				if (!prompt.trim()) throw new Error("Delegation prompt is empty.");
				pi.sendUserMessage(prompt);
			} catch (error) {
				const detail = error instanceof Error ? error.message : String(error);
				failChild(ctx, `Could not load child delegation prompt: ${detail}`);
			}
		},
	});

	pi.on("session_start", (_event, ctx) => {
		commandRules = loadCommandRules(ctx.cwd);
		state.sessionId = ctx.sessionManager.getSessionId() || sessionId;
		state.sessionPath = ctx.sessionManager.getSessionFile();
		state.actualModel = actualModel(ctx);
		ctx.ui.setTitle(`agent · ${process.env.HERDR_SUBAGENT_ROLE ?? "child"}`);
		save();
	});

	pi.on("before_agent_start", (_event, ctx) => {
		const error = verifyModel(ctx);
		if (error) {
			failChild(ctx, error);
			return;
		}
		state.status = "running";
		save();
	});

	pi.on("model_select", (_event, ctx) => {
		const error = verifyModel(ctx);
		if (error) failChild(ctx, error);
		else save();
	});

	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "bash") return;
		const command = typeof event.input.command === "string" ? event.input.command : "";
		const match = matchCommandRule(command, commandRules, ctx.cwd);
		if (!match) return;
		const reason = `${match.label} requires parent approval. Use a safe alternative or return the exact action the parent must perform.`;
		state.blockedActions.push(`${match.label}: ${command}`);
		save();
		return { block: true, reason };
	});

	pi.on("context", (event) => {
		if (synthesisInjected || state.usage.turns !== maxTurns - 1) return;
		synthesisInjected = true;
		return {
			messages: [
				...event.messages,
				{
					role: "user",
					content: [{ type: "text", text: "Turn budget warning: this is your final turn. Stop using tools and return the best result in the requested format now." }],
					timestamp: Date.now(),
				} as any,
			],
		};
	});

	pi.on("turn_end", (event, ctx) => {
		if (event.message.role === "assistant") {
			const usage = usageFromMessage(event.message);
			state.usage.input += usage.input;
			state.usage.output += usage.output;
			state.usage.cacheRead += usage.cacheRead;
			state.usage.cacheWrite += usage.cacheWrite;
			state.usage.cost += usage.cost;
			state.usage.turns += 1;
			const latest = messageText(event.message);
			if (latest) state.latestAssistant = latest;
		}
		if (state.usage.turns >= maxTurns) {
			budgetReached = true;
			state.status = "max_turns";
			save();
			ctx.abort();
		} else {
			save();
		}
	});

	pi.on("agent_end", (event) => {
		for (const message of event.messages) {
			if (message.role !== "assistant") continue;
			const latest = messageText(message);
			if (latest) state.latestAssistant = latest;
		}
		if (budgetReached) {
			state.status = "max_turns";
		} else if (state.status !== "failed") {
			const last = [...event.messages].reverse().find((message) => message.role === "assistant") as any;
			const failed = last?.stopReason === "error" || last?.stopReason === "aborted";
			state.status = failed ? "failed" : "complete";
			if (failed) state.error = last?.errorMessage || `Child stopped with ${last?.stopReason ?? "an error"}.`;
		}
		save();
	});

	pi.on("agent_settled", () => save());

	pi.on("session_shutdown", () => {
		if (state.status === "starting" || state.status === "running") {
			state.status = "aborted" satisfies AgentStatus;
			state.error = state.error ?? "Child session shut down before producing a terminal result.";
		}
		save();
	});
}

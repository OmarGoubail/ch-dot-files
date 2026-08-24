import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { getProfileRegistry, modelPolicyError, parseModelSpec, profileSelectionFromEntries, type ModelPolicy, type Profile, type ThinkingLevel } from "../shared/profile-registry.ts";
import { KeyedMutex, Semaphore } from "./concurrency.ts";
import { HerdrClient, type HerdrTab } from "./herdr.ts";
import { formatCost, formatUsage, latestBySession, nextSegment, recordsFromEntries, RUN_ENTRY_TYPE, totalUsage } from "./ledger.ts";
import { assertDelegationContextFits, buildInitialPrompt, filteredConversation, runtimeSystemPrompt } from "./prompt.ts";
import { loadRole, loadRoles } from "./roles.ts";
import type { AgentRole, AgentRunRecord, AgentStatus, ChildState, RunningAgent } from "./types.ts";
import { EMPTY_USAGE } from "./types.ts";

const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));
const CHILD_RUNTIME_PATH = join(EXTENSION_DIR, "child-runtime.ts");
const CODEX_ALIASES_PATH = join(EXTENSION_DIR, "..", "codex-account-aliases.ts");
const FFF_EXTENSION_PATH = join(homedir(), ".pi", "agent", "npm", "node_modules", "@ff-labs", "pi-fff", "src", "index.ts");
const SKILL_PATH = join(EXTENSION_DIR, "skills", "subagents");
const RUNTIME_DIR = join(homedir(), ".pi", "agent", "herdr-subagents", "runtime");
const MAX_CONCURRENCY = 4;
const registry = getProfileRegistry();
const capacity = new Semaphore(MAX_CONCURRENCY);
const writerLocks = new KeyedMutex();
const sessionLocks = new KeyedMutex();
const herdr = new HerdrClient();

const RunParams = Type.Object({
	action: StringEnum(["run", "result", "continue"] as const),
	agent: Type.Optional(Type.String({ description: "Role for action=run" })),
	task: Type.Optional(Type.String({ description: "Bounded task for action=run" })),
	context: Type.Optional(Type.String({ description: "Relevant findings, files, and constraints for action=run" })),
	output: Type.Optional(Type.String({ description: "Required result format for action=run" })),
	sessionId: Type.Optional(Type.String({ description: "Persisted child Pi session for result/continue" })),
	prompt: Type.Optional(Type.String({ description: "Focused follow-up for action=continue" })),
	detail: Type.Optional(StringEnum(["latest", "history"] as const)),
});

type ToolParams = {
	action: "run" | "result" | "continue";
	agent?: string;
	task?: string;
	context?: string;
	output?: string;
	sessionId?: string;
	prompt?: string;
	detail?: "latest" | "history";
};

type ResolvedPolicy = {
	profileName: string;
	profile: Profile;
	policy: ModelPolicy & { model: string; thinking: ThinkingLevel };
};

function shortText(value: string, length: number): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	return normalized.length <= length ? normalized : `${normalized.slice(0, Math.max(1, length - 1))}…`;
}

function linkedAbortSignal(signals: Array<AbortSignal | undefined>): { signal: AbortSignal; dispose: () => void } {
	const controller = new AbortController();
	const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
	const abort = () => controller.abort();
	for (const signal of active) {
		if (signal.aborted) controller.abort();
		else signal.addEventListener("abort", abort, { once: true });
	}
	return {
		signal: controller.signal,
		dispose: () => active.forEach((signal) => signal.removeEventListener("abort", abort)),
	};
}

function readChildState(path: string): ChildState | undefined {
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as ChildState;
		return parsed?.version === 1 ? parsed : undefined;
	} catch {
		return undefined;
	}
}

async function settledChildState(path: string): Promise<ChildState | undefined> {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const state = readChildState(path);
		if (state && !["starting", "running"].includes(state.status)) return state;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	return readChildState(path);
}

function response(record: AgentRunRecord, history?: string) {
	const result = history ?? (record.latestAssistant || "(no assistant result was recorded)");
	return {
		content: [{
			type: "text" as const,
			text: [
				`Status: ${record.status}`,
				`Session: ${record.sessionId}`,
				`Agent: ${record.role} · ${record.model}${record.thinking ? `:${record.thinking}` : ""}`,
				`Usage: ${formatUsage(record.usage)}`,
				...(record.blockedActions.length ? [`Blocked actions: ${record.blockedActions.join(" | ")}`] : []),
				...(record.error ? [`Error: ${record.error}`] : []),
				"",
				result,
			].join("\n"),
		}],
		details: record,
		isError: record.status === "failed" || record.status === "timed_out" || record.status === "aborted",
	};
}

function errorResponse(message: string) {
	return {
		content: [{ type: "text" as const, text: message }],
		details: { error: message },
		isError: true,
	};
}

function configuredPolicy(role: string, ctx: ExtensionContext, profileName?: string): ResolvedPolicy {
	const selectedProfile = profileName ?? profileSelectionFromEntries(ctx.sessionManager.getBranch());
	registry.reload(selectedProfile ? { preferred: selectedProfile } : {});
	if (selectedProfile && !registry.profile(selectedProfile)) throw new Error(`Unknown profile '${selectedProfile}'.`);
	const resolved = registry.resolveSubagent(role, profileName);
	if (!resolved) {
		const selected = profileName ?? registry.selectedName() ?? "none";
		throw new Error(`Agent '${role}' has no policy in profile '${selected}'.`);
	}
	const issue = modelPolicyError(resolved.profileName, resolved.profile, resolved.policy, `Agent '${role}'`);
	if (issue) throw new Error(issue);
	if (!resolved.policy.thinking) throw new Error(`Agent '${role}' in profile '${resolved.profileName}' has no thinking level.`);
	const spec = parseModelSpec(resolved.policy.model!);
	const model = spec ? ctx.modelRegistry.find(spec.provider, spec.id) : undefined;
	if (!model) throw new Error(`Configured model '${resolved.policy.model}' is unavailable in this Pi model registry.`);
	try {
		if (!ctx.modelRegistry.hasConfiguredAuth(model)) {
			throw new Error(`Configured model '${resolved.policy.model}' is unauthenticated. Authenticate provider '${spec!.provider}' first.`);
		}
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("Configured model")) throw error;
		// Dynamic providers may only prove auth when Pi starts the child.
	}
	return {
		profileName: resolved.profileName,
		profile: resolved.profile,
		policy: { model: resolved.policy.model!, thinking: resolved.policy.thinking },
	};
}

function createSystemPromptFile(role: AgentRole, id: string): string {
	mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 });
	const path = join(RUNTIME_DIR, `${id}.md`);
	writeFileSync(path, `${role.systemPrompt}\n\n${runtimeSystemPrompt(role)}\n`, { mode: 0o600 });
	return path;
}

function childArgs(input: {
	role: AgentRole;
	policy: ResolvedPolicy;
	sessionId: string;
	sessionPath?: string;
	sessionName: string;
	systemPromptPath: string;
}): string[] {
	return [
		"--no-extensions",
		"--extension", CHILD_RUNTIME_PATH,
		"--extension", CODEX_ALIASES_PATH,
		"--extension", FFF_EXTENSION_PATH,
		"--model", input.policy.policy.model,
		"--thinking", input.policy.policy.thinking,
		"--tools", input.role.tools.join(","),
		input.sessionPath ? "--session" : "--session-id",
		input.sessionPath ?? input.sessionId,
		"--name", input.sessionName,
		"--append-system-prompt", input.systemPromptPath,
	];
}

function terminalStatus(error: unknown, state?: ChildState): { status: AgentStatus; error?: string } {
	if (state && !["starting", "running"].includes(state.status)) {
		return { status: state.status as AgentStatus, error: state.error };
	}
	const message = error instanceof Error ? error.message : error ? String(error) : "Child settled without a terminal state.";
	if (/timed out|timeout/i.test(message)) return { status: "timed_out", error: message };
	if (/aborted/i.test(message)) return { status: "aborted", error: message };
	return { status: "failed", error: message };
}

export default function herdrSubagents(pi: ExtensionAPI): void {
	if (process.env.HERDR_SUBAGENT_CHILD === "1") return;

	let records: AgentRunRecord[] = [];
	const running = new Map<string, RunningAgent>();

	const updateFooter = (ctx: ExtensionContext) => {
		const usage = totalUsage(records);
		if (usage.cost === 0 && running.size === 0) {
			ctx.ui.setStatus("agents", undefined);
			return;
		}
		const active = running.size ? ` · ${running.size} active` : "";
		ctx.ui.setStatus("agents", `+ ${formatCost(usage.cost)} agents${active}`);
	};

	const appendRecord = (record: AgentRunRecord, ctx: ExtensionContext) => {
		records.push(record);
		pi.appendEntry(RUN_ENTRY_TYPE, record);
		updateFooter(ctx);
	};

	const runSegment = async (input: {
		role: AgentRole;
		policy: ResolvedPolicy;
		sessionId: string;
		sessionPath?: string;
		prompt: string;
		label: string;
		cwd: string;
		segment: number;
		externalSignal?: AbortSignal;
		ctx: ExtensionContext;
	}): Promise<AgentRunRecord> => {
		const controller = new AbortController();
		const linked = linkedAbortSignal([controller.signal, input.externalSignal]);
		const releases: Array<() => void> = [];
		const startedAt = new Date().toISOString();
		let tabId: string | undefined;
		let launchError: unknown;
		let childState: ChildState | undefined;
		let registered = false;
		const runtimeId = `${input.sessionId}-${input.segment}-${randomUUID()}`;
		const statePath = join(RUNTIME_DIR, `${runtimeId}.json`);
		const systemPromptPath = createSystemPromptFile(input.role, runtimeId);

		try {
			releases.push(await sessionLocks.acquire(input.sessionId, linked.signal));
			if (input.role.writer) releases.push(await writerLocks.acquire(input.cwd, linked.signal));
			releases.push(await capacity.acquire(linked.signal));
			running.set(input.sessionId, {
				sessionId: input.sessionId,
				role: input.role.name,
				cwd: input.cwd,
				startedAt,
				controller,
			});
			registered = true;
			updateFooter(input.ctx);

			if (!existsSync(FFF_EXTENSION_PATH)) {
				throw new Error("The configured @ff-labs/pi-fff extension is unavailable. Install packages before launching an agent.");
			}
			const workspaceId = process.env.HERDR_WORKSPACE_ID;
			if (process.env.HERDR_ENV !== "1" || !workspaceId) {
				throw new Error("Herdr subagents require the parent Pi session to run inside Herdr.");
			}
			const label = `${input.role.name} · ${shortText(input.label, 32)}`;
			const tab = await herdr.createTab({
				workspaceId,
				cwd: input.cwd,
				label,
				focus: false,
				signal: linked.signal,
				env: {
					PI_FFF_MODE: "override",
					HERDR_SUBAGENT_CHILD: "1",
					HERDR_SUBAGENT_ROLE: input.role.name,
					HERDR_SUBAGENT_SESSION_ID: input.sessionId,
					HERDR_SUBAGENT_STATE_PATH: statePath,
					HERDR_SUBAGENT_EXPECTED_MODEL: input.policy.policy.model,
					HERDR_SUBAGENT_ALLOWED_PROVIDERS: JSON.stringify(input.policy.profile.allowedProviders),
					HERDR_SUBAGENT_MAX_TURNS: String(input.role.maxTurns),
				},
			});
			tabId = tab.tabId;
			const active = running.get(input.sessionId);
			if (active) active.tabId = tabId;
			const agentName = `agent-${input.role.name.slice(0, 10).replace(/[^a-z0-9_-]/g, "-")}-${input.sessionId.slice(0, 8)}`.slice(0, 32);
			await herdr.startPi({
				name: agentName,
				paneId: tab.paneId,
				args: childArgs({
					role: input.role,
					policy: input.policy,
					sessionId: input.sessionId,
					sessionPath: input.sessionPath,
					sessionName: `${input.role.name} · ${shortText(input.label, 48)}`,
					systemPromptPath,
				}),
				signal: linked.signal,
			});
			await herdr.prompt({
				target: agentName,
				text: input.prompt,
				timeoutMs: input.role.timeoutMinutes * 60_000,
				signal: linked.signal,
			});
			childState = await settledChildState(statePath);
		} catch (error) {
			launchError = error;
			childState = await settledChildState(statePath);
		} finally {
			if (tabId) {
				try { await herdr.closeTab(tabId); } catch (error) { launchError ??= error; }
			}
			try { rmSync(systemPromptPath, { force: true }); } catch {}
			if (registered) running.delete(input.sessionId);
			updateFooter(input.ctx);
			for (const release of releases.reverse()) release();
			linked.dispose();
		}

		const terminal = terminalStatus(launchError, childState);
		const record: AgentRunRecord = {
			version: 1,
			sessionId: input.sessionId,
			sessionPath: childState?.sessionPath ?? input.sessionPath,
			segment: input.segment,
			role: input.role.name,
			profile: input.policy.profileName,
			cwd: input.cwd,
			model: input.policy.policy.model,
			thinking: input.policy.policy.thinking,
			status: terminal.status,
			latestAssistant: childState?.latestAssistant ?? "",
			usage: childState?.usage ?? { ...EMPTY_USAGE },
			maxTurns: input.role.maxTurns,
			timeoutMinutes: input.role.timeoutMinutes,
			blockedActions: childState?.blockedActions ?? [],
			error: terminal.error,
			startedAt,
			completedAt: new Date().toISOString(),
		};
		appendRecord(record, input.ctx);
		try { rmSync(statePath, { force: true }); } catch {}
		return record;
	};

	const runNew = async (params: ToolParams, signal: AbortSignal | undefined, ctx: ExtensionContext) => {
		if (!params.agent || !params.task || !params.context || !params.output) {
			throw new Error("action=run requires agent, task, context, and output.");
		}
		const role = loadRole(params.agent);
		const policy = configuredPolicy(role.name, ctx);
		const conversation = filteredConversation(ctx.sessionManager.getBranch());
		const prompt = buildInitialPrompt({
			conversation,
			task: params.task,
			context: params.context,
			output: params.output,
		});
		assertDelegationContextFits(prompt);
		const sessionId = randomUUID();
		return await runSegment({
			role,
			policy,
			sessionId,
			prompt,
			label: params.task,
			cwd: ctx.cwd,
			segment: 1,
			externalSignal: signal,
			ctx,
		});
	};

	const latestRecord = (sessionId: string): AgentRunRecord => {
		const record = latestBySession(records).get(sessionId);
		if (!record) throw new Error(`No child session '${sessionId}' belongs to this parent session.`);
		return record;
	};

	const continueSession = async (params: ToolParams, signal: AbortSignal | undefined, ctx: ExtensionContext) => {
		if (!params.sessionId || !params.prompt) throw new Error("action=continue requires sessionId and prompt.");
		const previous = latestRecord(params.sessionId);
		if (!previous.sessionPath || !existsSync(previous.sessionPath)) {
			throw new Error(`Child session '${params.sessionId}' has no readable persisted session file.`);
		}
		const role = loadRole(previous.role);
		const policy = configuredPolicy(role.name, ctx, previous.profile);
		return await runSegment({
			role,
			policy,
			sessionId: previous.sessionId,
			sessionPath: previous.sessionPath,
			prompt: params.prompt,
			label: params.prompt,
			cwd: previous.cwd,
			segment: nextSegment(records, previous.sessionId),
			externalSignal: signal,
			ctx,
		});
	};

	const resultFor = (params: ToolParams) => {
		if (!params.sessionId) throw new Error("action=result requires sessionId.");
		const record = latestRecord(params.sessionId);
		if (params.detail !== "history") return response(record);
		if (!record.sessionPath || !existsSync(record.sessionPath)) {
			throw new Error(`Child session '${record.sessionId}' has no readable persisted session file.`);
		}
		const session = SessionManager.open(record.sessionPath);
		return response(record, filteredConversation(session.getBranch()));
	};

	const reopen = async (record: AgentRunRecord, ctx: ExtensionContext) => {
		if (!record.sessionPath || !existsSync(record.sessionPath)) throw new Error("The child session file is unavailable.");
		const workspaceId = process.env.HERDR_WORKSPACE_ID;
		if (!workspaceId) throw new Error("Reopening requires Herdr.");
		if (!existsSync(FFF_EXTENSION_PATH)) throw new Error("The configured @ff-labs/pi-fff extension is unavailable.");
		const role = loadRole(record.role);
		const policy = configuredPolicy(role.name, ctx, record.profile);
		const systemPromptPath = createSystemPromptFile(role, `reopen-${record.sessionId}-${randomUUID()}`);
		let tab: HerdrTab | undefined;
		try {
			tab = await herdr.createTab({
				workspaceId,
				cwd: record.cwd,
				label: `${record.role} · ${record.sessionId.slice(0, 8)}`,
				focus: true,
				env: { PI_FFF_MODE: "override" },
			});
			await herdr.startPi({
				name: `reopen-${record.sessionId.slice(0, 8)}`,
				paneId: tab.paneId,
				args: [
					"--no-extensions",
					"--extension", CHILD_RUNTIME_PATH,
					"--extension", CODEX_ALIASES_PATH,
					"--extension", FFF_EXTENSION_PATH,
					"--session", record.sessionPath,
					"--model", policy.policy.model,
					"--thinking", policy.policy.thinking,
					"--tools", role.tools.join(","),
					"--append-system-prompt", systemPromptPath,
				],
			});
		} catch (error) {
			if (tab) await herdr.closeTab(tab.tabId);
			throw error;
		} finally {
			try { rmSync(systemPromptPath, { force: true }); } catch {}
		}
	};

	pi.on("resources_discover", () => ({ skillPaths: [SKILL_PATH] }));
	pi.on("session_start", (_event, ctx) => {
		const selectedProfile = profileSelectionFromEntries(ctx.sessionManager.getBranch());
		registry.reload(selectedProfile ? { preferred: selectedProfile } : {});
		records = recordsFromEntries(ctx.sessionManager.getEntries());
		updateFooter(ctx);
	});

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: "Run a bounded Herdr-backed Pi agent, read its latest persisted result, or continue the same child session. Model and thinking are resolved strictly from profiles.json; callers never choose them.",
		promptSnippet: "Delegate bounded work to a configured Herdr-backed Pi agent and wait for its result.",
		promptGuidelines: [
			"Use action=run with agent, task, context, and output; give parallel agents distinct responsibilities.",
			"Read the returned latest result before requesting history. Use action=continue for a focused follow-up in the same child session.",
		],
		parameters: RunParams,
		executionMode: "parallel",
		async execute(_toolCallId, params: ToolParams, signal, onUpdate, ctx) {
			try {
				if (params.action === "result") return resultFor(params);
				onUpdate?.({
					content: [{ type: "text", text: params.action === "run" ? `Launching ${params.agent} in Herdr…` : `Continuing ${params.sessionId} in Herdr…` }],
					details: { action: params.action },
				});
				const record = params.action === "run"
					? await runNew(params, signal, ctx)
					: await continueSession(params, signal, ctx);
				return response(record);
			} catch (error) {
				return errorResponse(error instanceof Error ? error.message : String(error));
			}
		},
	});

	pi.registerCommand("agent", {
		description: "Run a configured agent: /agent <role> <task>",
		getArgumentCompletions: (prefix) => {
			if (prefix.trim().includes(" ")) return null;
			return loadRoles().roles.map((role) => ({ value: role.name, label: role.name, description: role.description }));
		},
		handler: async (args, ctx) => {
			const [agent, ...taskParts] = args.trim().split(/\s+/);
			const task = taskParts.join(" ");
			if (!agent || !task) {
				ctx.ui.notify("Usage: /agent <role> <task>", "error");
				return;
			}
			try {
				const record = await runNew({
					action: "run",
					agent,
					task,
					context: "Manual delegation requested by the user from the current parent conversation.",
					output: "Return a concise, actionable result for the parent.",
				}, undefined, ctx);
				pi.sendMessage({ customType: "herdr-subagent-result", content: response(record).content[0].text, display: true });
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});

	pi.registerCommand("agents", {
		description: "Inspect agent sessions or show child cost: /agents [cost]",
		handler: async (args, ctx) => {
			if (args.trim() === "cost") {
				const usage = totalUsage(records);
				const breakdown = records.map((record) => `${record.role} ${record.sessionId.slice(0, 8)}#${record.segment}: ${formatUsage(record.usage)}`);
				ctx.ui.notify([`Agent total: ${formatUsage(usage)}`, ...breakdown].join("\n"));
				return;
			}
			const latest = [...latestBySession(records).values()].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
			const options = [
				...[...running.values()].map((item) => `running · ${item.role} · ${item.sessionId.slice(0, 8)}`),
				...latest.map((item) => `${item.status} · ${item.role} · ${item.sessionId.slice(0, 8)} · ${formatCost(item.usage.cost)}`),
			];
			if (options.length === 0) {
				ctx.ui.notify("No agent sessions belong to this parent session.");
				return;
			}
			const selected = await ctx.ui.select("Agent sessions", options);
			if (!selected) return;
			const shortId = selected.split(" · ")[2];
			const active = [...running.values()].find((item) => item.sessionId.startsWith(shortId));
			if (active) {
				const action = await ctx.ui.select("Running agent", ["Stop", "Cancel"]);
				if (action === "Stop") {
					active.controller.abort();
					if (active.tabId) await herdr.closeTab(active.tabId);
				}
				return;
			}
			const record = latest.find((item) => item.sessionId.startsWith(shortId));
			if (!record) return;
			const action = await ctx.ui.select("Completed agent", ["Reopen session", "Show latest result", "Cancel"]);
			if (action === "Reopen session") await reopen(record, ctx);
			if (action === "Show latest result") ctx.ui.notify(record.latestAssistant || "(no assistant result)");
		},
	});
}

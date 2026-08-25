import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { PROFILE_SELECTION_ENTRY_TYPE } from "../shared/profile-registry.ts";

const DEFAULT_SESSION_ROOT = join(
	process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"),
	"sessions",
);
const IGNORED_ACTION_TOOLS = new Set([
	"ast-search",
	"background-list",
	"background-logs",
	"choose_from_options",
	"context_checkpoint",
	"context_compact",
	"context_timeline",
	"elixir_ast_search",
	"find",
	"get_search_content",
	"grep",
	"ls",
	"multi_tool_use.parallel",
	"question",
	"read",
	"review_memory",
]);
const MAX_USER_PROMPT_CHARS = 2_500;
const MAX_ASSISTANT_OUTCOME_CHARS = 6_000;
const MAX_ACTION_RESULT_CHARS = 1_600;

type JsonRecord = Record<string, unknown>;

type SessionEntry = JsonRecord & {
	type?: string;
	id?: string;
	parentId?: string | null;
	timestamp?: string;
	message?: JsonRecord;
};

type ToolCall = {
	id?: string;
	name: string;
	arguments: JsonRecord;
};

export type EvidenceAction = {
	name: string;
	summary: string;
	status: "succeeded" | "failed" | "pending";
	result?: string;
};

export type WorkTaskEvidence = {
	sessionId: string;
	sessionPath: string;
	project: string;
	cwd?: string;
	userPrompt: string;
	firstActivityAt: string;
	lastActivityAt: string;
	assistantOutcomes: string[];
	actions: EvidenceAction[];
	toolCounts: Record<string, number>;
};

export type DailyWorkEvidence = {
	date: string;
	timeZone: string;
	profile: string;
	generatedAt: string;
	sessionCount: number;
	tasks: WorkTaskEvidence[];
};

export type CollectDailyWorkEvidenceOptions = {
	date: string;
	timeZone: string;
	profile?: string;
	sessionRoot?: string;
	now?: Date;
};

type MutableTask = Omit<WorkTaskEvidence, "actions"> & {
	actions: Map<string, EvidenceAction>;
};

type SessionIndex = {
	entries: SessionEntry[];
	byId: Map<string, SessionEntry>;
	profileFor: (entry: SessionEntry) => string | undefined;
	nearestUserId: (entry: SessionEntry) => string | undefined;
};

export function collectDailyWorkEvidence(options: CollectDailyWorkEvidenceOptions): DailyWorkEvidence {
	const profile = options.profile ?? "work";
	const dateFormatter = createDateFormatter(options.timeZone);
	const tasks: MutableTask[] = [];

	for (const sessionPath of sessionFiles(options.sessionRoot ?? DEFAULT_SESSION_ROOT)) {
		const parsed = parseSession(sessionPath);
		if (!parsed) continue;
		const { header, index } = parsed;
		const sessionId = typeof header.id === "string" ? header.id : basename(sessionPath, ".jsonl");
		const cwd = typeof header.cwd === "string" ? header.cwd : undefined;
		const sessionTasks = collectSessionTasks({
			sessionId,
			sessionPath,
			cwd,
			index,
			date: options.date,
			profile,
			dateFormatter,
		});
		tasks.push(...sessionTasks);
	}

	const finalizedTasks = tasks
		.map(finalizeTask)
		.filter((task) => task.assistantOutcomes.length > 0 || task.actions.length > 0)
		.sort((left, right) => left.firstActivityAt.localeCompare(right.firstActivityAt));
	return {
		date: options.date,
		timeZone: options.timeZone,
		profile,
		generatedAt: (options.now ?? new Date()).toISOString(),
		sessionCount: new Set(finalizedTasks.map((task) => task.sessionId)).size,
		tasks: finalizedTasks,
	};
}

function collectSessionTasks(input: {
	sessionId: string;
	sessionPath: string;
	cwd?: string;
	index: SessionIndex;
	date: string;
	profile: string;
	dateFormatter: Intl.DateTimeFormat;
}): MutableTask[] {
	const tasks = new Map<string, MutableTask>();
	const calls = new Map<string, { call: ToolCall; entry: SessionEntry }>();
	const isTargetWorkEntry = (entry: SessionEntry) => input.index.profileFor(entry) === input.profile
		&& localDate(entry.timestamp, input.dateFormatter) === input.date;

	for (const entry of input.index.entries) {
		if (entry.type !== "message" || entry.message?.role !== "assistant") continue;
		for (const call of toolCalls(entry.message.content)) {
			if (call.id) calls.set(call.id, { call, entry });
		}
	}

	const ensureTask = (entry: SessionEntry, fallbackIndex: number): MutableTask => {
		const userId = input.index.nearestUserId(entry);
		const key = userId ?? `standalone:${entry.id ?? fallbackIndex}`;
		const existing = tasks.get(key);
		if (existing) return existing;
		const userEntry = userId ? input.index.byId.get(userId) : undefined;
		const userPrompt = userEntry && input.index.profileFor(userEntry) === input.profile
			? compactText(contentText(userEntry.message?.content), MAX_USER_PROMPT_CHARS)
			: "Standalone work action";
		const timestamp = entry.timestamp ?? new Date(0).toISOString();
		const task: MutableTask = {
			sessionId: input.sessionId,
			sessionPath: input.sessionPath,
			project: input.cwd ? basename(input.cwd) : "unknown",
			cwd: input.cwd,
			userPrompt,
			firstActivityAt: timestamp,
			lastActivityAt: timestamp,
			assistantOutcomes: [],
			actions: new Map(),
			toolCounts: {},
		};
		tasks.set(key, task);
		return task;
	};

	for (const [entryIndex, entry] of input.index.entries.entries()) {
		if (!isTargetWorkEntry(entry) || entry.type !== "message" || !entry.message) continue;
		const task = ensureTask(entry, entryIndex);
		updateActivityRange(task, entry.timestamp);
		const role = entry.message.role;

		if (role === "assistant") {
			const entryCalls = toolCalls(entry.message.content);
			for (const call of entryCalls) {
				task.toolCounts[call.name] = (task.toolCounts[call.name] ?? 0) + 1;
				if (!isActionTool(call.name, call.arguments)) continue;
				const actionKey = call.id ?? `${entry.id ?? entryIndex}:${call.name}`;
				task.actions.set(actionKey, {
					name: call.name,
					summary: summarizeToolCall(call.name, call.arguments),
					status: "pending",
				});
			}
			const outcome = assistantOutcome(entry.message, entryCalls.length);
			if (outcome) pushUnique(task.assistantOutcomes, outcome);
			continue;
		}

		if (role === "toolResult") {
			const toolCallId = typeof entry.message.toolCallId === "string" ? entry.message.toolCallId : undefined;
			const paired = toolCallId ? calls.get(toolCallId) : undefined;
			const name = typeof entry.message.toolName === "string" ? entry.message.toolName : paired?.call.name;
			if (!name) continue;
			const args = paired?.call.arguments ?? {};
			if (!isActionTool(name, args)) continue;
			const actionKey = toolCallId ?? `${entry.id ?? entryIndex}:${name}`;
			const failed = entry.message.isError === true;
			const result = actionResult(name, contentText(entry.message.content));
			task.actions.set(actionKey, {
				name,
				summary: paired ? summarizeToolCall(name, args) : `Used ${name}`,
				status: failed ? "failed" : "succeeded",
				...(result ? { result } : {}),
			});
			continue;
		}

		if (role === "bashExecution") {
			if (entry.message.excludeFromContext === true) continue;
			const command = typeof entry.message.command === "string" ? entry.message.command : "";
			const output = typeof entry.message.output === "string" ? entry.message.output : "";
			const failed = typeof entry.message.exitCode === "number" && entry.message.exitCode !== 0;
			task.actions.set(entry.id ?? `bash:${entryIndex}`, {
				name: "bashExecution",
				summary: `Ran: ${compactText(command, 800)}`,
				status: failed ? "failed" : "succeeded",
				...(output ? { result: compactText(output, MAX_ACTION_RESULT_CHARS) } : {}),
			});
		}
	}

	return [...tasks.values()];
}

function parseSession(path: string): { header: SessionEntry; index: SessionIndex } | undefined {
	let lines: string[];
	try {
		lines = readFileSync(path, "utf8").split("\n");
	} catch {
		return undefined;
	}
	const parsed: SessionEntry[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		try {
			const value = JSON.parse(line) as unknown;
			if (isRecord(value)) parsed.push(value as SessionEntry);
		} catch {
			continue;
		}
	}
	const header = parsed.find((entry) => entry.type === "session");
	if (!header) return undefined;
	const entries = parsed.filter((entry) => entry.type !== "session");
	return { header, index: createSessionIndex(entries) };
}

function createSessionIndex(entries: SessionEntry[]): SessionIndex {
	const byId = new Map(entries.flatMap((entry) => entry.id ? [[entry.id, entry] as const] : []));
	const profileCache = new Map<string, string | null>();
	const userCache = new Map<string, string | null>();

	const profileFor = (entry: SessionEntry): string | undefined => {
		const trail: string[] = [];
		let current: SessionEntry | undefined = entry;
		let resolved: string | undefined;
		while (current) {
			if (current.id && profileCache.has(current.id)) {
				resolved = profileCache.get(current.id) ?? undefined;
				break;
			}
			if (current.id) trail.push(current.id);
			if (current.type === "custom" && current.customType === PROFILE_SELECTION_ENTRY_TYPE) {
				const data = isRecord(current.data) ? current.data : undefined;
				resolved = typeof data?.profile === "string" ? data.profile : undefined;
				break;
			}
			current = typeof current.parentId === "string" ? byId.get(current.parentId) : undefined;
		}
		for (const id of trail) profileCache.set(id, resolved ?? null);
		return resolved;
	};

	const nearestUserId = (entry: SessionEntry): string | undefined => {
		const trail: string[] = [];
		let current: SessionEntry | undefined = entry;
		let resolved: string | undefined;
		while (current) {
			if (current.id && userCache.has(current.id)) {
				resolved = userCache.get(current.id) ?? undefined;
				break;
			}
			if (current.id) trail.push(current.id);
			if (current.type === "message" && current.message?.role === "user") {
				resolved = current.id;
				break;
			}
			current = typeof current.parentId === "string" ? byId.get(current.parentId) : undefined;
		}
		for (const id of trail) userCache.set(id, resolved ?? null);
		return resolved;
	};

	return { entries, byId, profileFor, nearestUserId };
}

function sessionFiles(root: string): string[] {
	const files: string[] = [];
	const visit = (directory: string) => {
		let entries;
		try {
			entries = readdirSync(directory, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path);
		}
	};
	visit(root);
	return files.sort();
}

function createDateFormatter(timeZone: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
}

function localDate(timestamp: unknown, formatter: Intl.DateTimeFormat): string | undefined {
	if (typeof timestamp !== "string") return undefined;
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return undefined;
	const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
	return parts.year && parts.month && parts.day ? `${parts.year}-${parts.month}-${parts.day}` : undefined;
}

function contentText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.flatMap((part) => isRecord(part) && part.type === "text" && typeof part.text === "string" ? [part.text] : [])
		.join("\n");
}

function toolCalls(content: unknown): ToolCall[] {
	if (!Array.isArray(content)) return [];
	return content.flatMap((part) => {
		if (!isRecord(part) || part.type !== "toolCall" || typeof part.name !== "string") return [];
		return [{
			id: typeof part.id === "string" ? part.id : undefined,
			name: part.name,
			arguments: isRecord(part.arguments) ? part.arguments : {},
		}];
	});
}

function assistantOutcome(message: JsonRecord, callCount: number): string | undefined {
	const stopReason = typeof message.stopReason === "string" ? message.stopReason : undefined;
	if (callCount > 0 || stopReason === "error" || stopReason === "aborted" || stopReason === "toolUse") return undefined;
	const text = compactText(contentText(message.content), MAX_ASSISTANT_OUTCOME_CHARS);
	return text || undefined;
}

function isActionTool(name: string, args: JsonRecord): boolean {
	if (IGNORED_ACTION_TOOLS.has(name)) return false;
	if (name === "lsp") {
		return ["actions", "diagnostics", "flycheck", "rename", "ssr", "workspace_diagnostics"]
			.includes(typeof args.action === "string" ? args.action : "");
	}
	return true;
}

function summarizeToolCall(name: string, args: JsonRecord): string {
	if (name === "edit") {
		const count = Array.isArray(args.edits) ? args.edits.length : 1;
		return `Edited ${stringArg(args.path, "a file")} (${count} operation${count === 1 ? "" : "s"})`;
	}
	if (name === "write") return `Wrote ${stringArg(args.path, "a file")}`;
	if (name === "ast-rewrite" || name === "elixir_ast_replace") {
		return `Applied ${name} in ${stringArg(args.path, "the project")}`;
	}
	if (name === "bash") return `Ran: ${compactText(stringArg(args.command, "shell command"), 800)}`;
	if (name === "subagent") {
		const action = stringArg(args.action, "run");
		const agent = stringArg(args.agent, "agent");
		const task = typeof args.task === "string" ? ` — ${compactText(args.task, 500)}` : "";
		return `Subagent ${action}: ${agent}${task}`;
	}
	if (name === "lsp") return `LSP ${stringArg(args.action, "operation")} on ${stringArg(args.file, "the project")}`;
	if (name === "web_search") {
		const query = typeof args.query === "string" ? args.query : Array.isArray(args.queries) ? args.queries.join(" | ") : "work research";
		return `Researched: ${compactText(query, 600)}`;
	}
	if (name === "source_check") return `Checked source claim: ${compactText(stringArg(args.claim, "claim"), 600)}`;
	if (name === "fetch_content") {
		const target = typeof args.url === "string" ? args.url : Array.isArray(args.urls) ? args.urls.join(" | ") : "content";
		return `Fetched: ${compactText(target, 600)}`;
	}
	if (name === "codesearch") return `Searched code for: ${compactText(stringArg(args.query, "pattern"), 500)}`;
	if (name === "elixir_eval") return `Evaluated Elixir against ${stringArg(args.target, "the project")}`;
	const details = ["action", "path", "file", "query", "url", "repo", "label"]
		.flatMap((key) => typeof args[key] === "string" ? [`${key}=${compactText(String(args[key]), 300)}`] : []);
	return details.length > 0 ? `${name}: ${details.join(", ")}` : `Used ${name}`;
}

function actionResult(name: string, text: string): string | undefined {
	if (!text || ["edit", "write", "ast-rewrite", "elixir_ast_replace"].includes(name)) return undefined;
	return compactText(text, name === "subagent" ? 2_500 : MAX_ACTION_RESULT_CHARS) || undefined;
}

function compactText(value: string, maxChars: number): string {
	const sanitized = redactSensitive(value)
		.replace(/```[\s\S]*?```/g, "[code omitted]")
		.replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/g, "[embedded data omitted]")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	return sanitized.length <= maxChars ? sanitized : `${sanitized.slice(0, Math.max(1, maxChars - 1))}…`;
}

function redactSensitive(value: string): string {
	return value
		.replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, "[private key redacted]")
		.replace(/\b(Bearer\s+)[^\s"']+/gi, "$1[redacted]")
		.replace(/\b(ghp_|github_pat_|sk-)[A-Za-z0-9_-]{12,}/g, "$1[redacted]")
		.replace(/\b(api[_-]?key|access[_-]?token|authorization|password|secret)\b(\s*[:=]\s*)[^\s,"']+/gi, "$1$2[redacted]");
}

function stringArg(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function updateActivityRange(task: MutableTask, timestamp: string | undefined): void {
	if (!timestamp) return;
	if (timestamp < task.firstActivityAt) task.firstActivityAt = timestamp;
	if (timestamp > task.lastActivityAt) task.lastActivityAt = timestamp;
}

function finalizeTask(task: MutableTask): WorkTaskEvidence {
	return {
		...task,
		assistantOutcomes: [...new Set(task.assistantOutcomes)],
		actions: [...task.actions.values()],
	};
}

function pushUnique(values: string[], value: string): void {
	if (!values.includes(value)) values.push(value);
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { AgentRole } from "./types.ts";

const MAX_PARENT_CONTEXT_TOKENS = 100_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

function contentText(content: unknown): string {
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	return content
		.filter((part): part is { type: "text"; text: string } => {
			return Boolean(part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string");
		})
		.map((part) => part.text.trim())
		.filter(Boolean)
		.join("\n");
}

export function messageText(message: unknown): string {
	if (!message || typeof message !== "object") return "";
	return contentText((message as { content?: unknown }).content);
}

export function filteredConversation(entries: readonly SessionEntry[]): string {
	const lines: string[] = [];
	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const role = entry.message.role;
		if (role !== "user" && role !== "assistant") continue;
		const text = messageText(entry.message);
		if (text) lines.push(`${role === "user" ? "User" : "Assistant"}:\n${text}`);
	}
	return lines.join("\n\n");
}

export function assertDelegationContextFits(prompt: string): void {
	const estimatedTokens = Math.ceil(prompt.length / CHARS_PER_TOKEN_ESTIMATE);
	if (estimatedTokens > MAX_PARENT_CONTEXT_TOKENS) {
		throw new Error(
			`Delegation context is approximately ${estimatedTokens.toLocaleString()} tokens, above the ${MAX_PARENT_CONTEXT_TOKENS.toLocaleString()}-token limit. Compact the parent session or reduce the supplied context before delegating.`,
		);
	}
}

export function runtimeSystemPrompt(role: AgentRole): string {
	return [
		`You are running as the '${role.name}' child in a parent-owned delegation.`,
		`You have at most ${role.maxTurns} assistant turns for this run segment. Reserve your final turn for the requested result.`,
		"The parent owns product decisions, permissions, and final synthesis. Return unresolved decisions or required protected actions instead of asking the human directly.",
		"When a command is blocked, use a safe alternative or report the exact parent action required.",
		"Finish with the requested output rather than proposing another subagent.",
	].join("\n");
}

export function buildInitialPrompt(input: {
	conversation: string;
	task: string;
	context: string;
	output: string;
}): string {
	return [
		"# Parent conversation",
		"The following is the user/assistant conversation so far. Tool calls, tool results, and hidden file reads were intentionally omitted.",
		input.conversation || "(no prior user/assistant text)",
		"# Delegation context",
		input.context.trim(),
		"# Task",
		input.task.trim(),
		"# Required output",
		input.output.trim(),
	].join("\n\n");
}

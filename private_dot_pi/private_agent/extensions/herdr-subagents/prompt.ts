import type { AgentRole } from "./types.ts";

const MAX_PARENT_HISTORY_TOKENS = 70_000;
const MAX_DELEGATION_TOKENS = 100_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;
const OMITTED_HISTORY = "[Earlier conversation omitted because the parent context exceeded 70,000 estimated tokens.]";

type ContextMessage = {
	role?: unknown;
	content?: unknown;
	summary?: unknown;
};

type ContextSource = {
	buildContextEntries(): readonly unknown[];
};

type ContextEntry = {
	type?: unknown;
	message?: unknown;
	summary?: unknown;
};

type DialogueBlock = {
	role: "user" | "assistant";
	text: string;
};

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

function renderDialogue(blocks: readonly DialogueBlock[]): string {
	return blocks.map((block) => `${block.role === "user" ? "User" : "Assistant"}:\n${block.text}`).join("\n\n");
}

function dialogueUnits(blocks: readonly DialogueBlock[]): DialogueBlock[][] {
	const units: DialogueBlock[][] = [];
	for (const block of blocks) {
		if (block.role === "user" || units.length === 0) units.push([block]);
		else units[units.length - 1].push(block);
	}
	return units;
}

function truncateMiddle(value: string, maxChars: number): string {
	if (value.length <= maxChars) return value;
	const marker = "\n[Middle of oversized context omitted]\n";
	if (maxChars <= marker.length) return value.slice(-Math.max(0, maxChars));
	const available = maxChars - marker.length;
	const head = Math.floor(available / 2);
	return `${value.slice(0, head)}${marker}${value.slice(value.length - (available - head))}`;
}

function boundedConversation(summaries: readonly string[], dialogue: readonly DialogueBlock[]): string {
	const summaryText = summaries.join("\n\n");
	const fullDialogue = renderDialogue(dialogue);
	const full = [summaryText, fullDialogue].filter(Boolean).join("\n\n");
	const maxChars = MAX_PARENT_HISTORY_TOKENS * CHARS_PER_TOKEN_ESTIMATE;
	if (full.length <= maxChars) return full;

	const summaryBudget = Math.max(0, maxChars - OMITTED_HISTORY.length - 4);
	const boundedSummary = truncateMiddle(summaryText, summaryBudget);
	let used = boundedSummary.length + OMITTED_HISTORY.length + (boundedSummary ? 4 : 0);
	const selected: string[] = [];
	const units = dialogueUnits(dialogue);
	for (let index = units.length - 1; index >= 0; index -= 1) {
		const rendered = renderDialogue(units[index]);
		const separator = 2;
		if (used + separator + rendered.length > maxChars) {
			if (selected.length === 0 && rendered.length > 0) {
				const available = Math.max(0, maxChars - used - separator);
				selected.unshift(truncateMiddle(rendered, available));
			}
			break;
		}
		selected.unshift(rendered);
		used += separator + rendered.length;
	}

	const recent = selected.join("\n\n");
	return [boundedSummary, OMITTED_HISTORY, recent].filter(Boolean).join("\n\n");
}

export function filteredConversation(messages: readonly unknown[]): string {
	const summaries: string[] = [];
	const dialogue: DialogueBlock[] = [];
	for (const value of messages) {
		if (!value || typeof value !== "object") continue;
		const message = value as ContextMessage;
		if ((message.role === "compactionSummary" || message.role === "branchSummary") && typeof message.summary === "string" && message.summary.trim()) {
			const label = message.role === "compactionSummary" ? "Earlier conversation summary" : "Branch summary";
			summaries.push(`${label}:\n${message.summary.trim()}`);
			continue;
		}
		if (message.role !== "user" && message.role !== "assistant") continue;
		const text = messageText(message);
		if (text) dialogue.push({ role: message.role, text });
	}
	return boundedConversation(summaries, dialogue);
}

export function delegationConversation(source: ContextSource): string {
	const messages: unknown[] = [];
	for (const value of source.buildContextEntries()) {
		if (!value || typeof value !== "object") continue;
		const entry = value as ContextEntry;
		if (entry.type === "message") messages.push(entry.message);
		if (entry.type === "compaction" && typeof entry.summary === "string") {
			messages.push({ role: "compactionSummary", summary: entry.summary });
		}
		if (entry.type === "branch_summary" && typeof entry.summary === "string") {
			messages.push({ role: "branchSummary", summary: entry.summary });
		}
	}
	return filteredConversation(messages);
}

export function assertDelegationContextFits(prompt: string): void {
	const estimatedTokens = Math.ceil(prompt.length / CHARS_PER_TOKEN_ESTIMATE);
	if (estimatedTokens > MAX_DELEGATION_TOKENS) {
		throw new Error(
			`Delegation context is approximately ${estimatedTokens.toLocaleString()} tokens, above the ${MAX_DELEGATION_TOKENS.toLocaleString()}-token limit. Reduce the explicit task, context, or output before delegating.`,
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

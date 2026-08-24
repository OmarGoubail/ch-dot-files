import type { ThinkingLevel } from "../shared/profile-registry.ts";

export type AgentStatus = "complete" | "max_turns" | "failed" | "timed_out" | "aborted";

export type AgentUsage = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	turns: number;
};

export type AgentRole = {
	name: string;
	description: string;
	tools: string[];
	maxTurns: number;
	timeoutMinutes: number;
	writer: boolean;
	systemPrompt: string;
};

export type ChildState = {
	version: 1;
	sessionId: string;
	sessionPath?: string;
	status: "starting" | "running" | AgentStatus;
	expectedModel: string;
	actualModel?: string;
	latestAssistant: string;
	usage: AgentUsage;
	maxTurns: number;
	blockedActions: string[];
	error?: string;
	updatedAt: string;
};

export type AgentRunRecord = {
	version: 1;
	sessionId: string;
	sessionPath?: string;
	segment: number;
	role: string;
	profile: string;
	cwd: string;
	model: string;
	thinking?: ThinkingLevel;
	status: AgentStatus;
	latestAssistant: string;
	usage: AgentUsage;
	maxTurns: number;
	timeoutMinutes: number;
	blockedActions: string[];
	error?: string;
	startedAt: string;
	completedAt: string;
};

export type RunningAgent = {
	sessionId: string;
	role: string;
	cwd: string;
	startedAt: string;
	controller: AbortController;
	tabId?: string;
};

export const EMPTY_USAGE: AgentUsage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	cost: 0,
	turns: 0,
};

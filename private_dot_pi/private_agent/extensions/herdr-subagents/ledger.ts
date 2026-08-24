import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { AgentRunRecord, AgentUsage } from "./types.ts";
import { EMPTY_USAGE } from "./types.ts";

export const RUN_ENTRY_TYPE = "herdr-subagents.run";

function isRunRecord(value: unknown): value is AgentRunRecord {
	if (!value || typeof value !== "object") return false;
	const record = value as Partial<AgentRunRecord>;
	return record.version === 1 && typeof record.sessionId === "string" && typeof record.role === "string" && typeof record.segment === "number";
}

export function recordsFromEntries(entries: readonly SessionEntry[]): AgentRunRecord[] {
	return entries.flatMap((entry) => {
		return entry.type === "custom" && entry.customType === RUN_ENTRY_TYPE && isRunRecord(entry.data) ? [entry.data] : [];
	});
}

export function addUsage(left: AgentUsage, right: AgentUsage): AgentUsage {
	return {
		input: left.input + right.input,
		output: left.output + right.output,
		cacheRead: left.cacheRead + right.cacheRead,
		cacheWrite: left.cacheWrite + right.cacheWrite,
		cost: left.cost + right.cost,
		turns: left.turns + right.turns,
	};
}

export function totalUsage(records: readonly AgentRunRecord[]): AgentUsage {
	return records.reduce((usage, record) => addUsage(usage, record.usage), { ...EMPTY_USAGE });
}

export function latestBySession(records: readonly AgentRunRecord[]): Map<string, AgentRunRecord> {
	const result = new Map<string, AgentRunRecord>();
	for (const record of records) {
		const existing = result.get(record.sessionId);
		if (!existing || record.segment >= existing.segment) result.set(record.sessionId, record);
	}
	return result;
}

export function nextSegment(records: readonly AgentRunRecord[], sessionId: string): number {
	return records.filter((record) => record.sessionId === sessionId).reduce((highest, record) => Math.max(highest, record.segment), 0) + 1;
}

export function formatCost(cost: number): string {
	if (cost >= 10) return `$${cost.toFixed(2)}`;
	if (cost >= 1) return `$${cost.toFixed(3)}`;
	return `$${cost.toFixed(4)}`;
}

export function formatUsage(usage: AgentUsage): string {
	const compact = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}m` : value >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : String(value);
	return `${formatCost(usage.cost)} · ${usage.turns} turns · ↑${compact(usage.input)} ↓${compact(usage.output)} R${compact(usage.cacheRead)}`;
}

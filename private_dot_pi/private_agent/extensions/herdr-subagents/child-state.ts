import { readFileSync } from "node:fs";
import type { ChildState } from "./types.ts";

export function readChildState(path: string): ChildState | undefined {
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as ChildState;
		return parsed?.version === 1 ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(finish, ms);
		const abort = () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", abort);
			reject(new Error("Child telemetry wait aborted."));
		};
		function finish() {
			signal?.removeEventListener("abort", abort);
			resolve();
		}
		if (signal?.aborted) abort();
		else signal?.addEventListener("abort", abort, { once: true });
	});
}

export async function waitForTerminalChildState(
	path: string,
	options: { timeoutMs: number; signal?: AbortSignal; pollIntervalMs?: number },
): Promise<ChildState> {
	const deadline = Date.now() + options.timeoutMs;
	const pollIntervalMs = options.pollIntervalMs ?? 100;
	let state: ChildState | undefined;

	while (Date.now() < deadline) {
		if (options.signal?.aborted) throw new Error("Child telemetry wait aborted.");
		state = readChildState(path);
		if (state && state.status !== "starting" && state.status !== "running") return state;
		await wait(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())), options.signal);
	}

	state = readChildState(path);
	if (state && state.status !== "starting" && state.status !== "running") return state;
	throw new Error(`Child telemetry timed out after ${options.timeoutMs}ms; last status: ${state?.status ?? "missing"}.`);
}

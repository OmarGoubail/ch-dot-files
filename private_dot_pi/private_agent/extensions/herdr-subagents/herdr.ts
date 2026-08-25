import { spawn } from "node:child_process";

export type HerdrTab = { tabId: string; paneId: string };

type RunOptions = {
	signal?: AbortSignal;
	timeoutMs?: number;
};

function parseEnvelope(stdout: string, stderr: string): unknown {
	for (const source of [stdout, stderr]) {
		for (const line of source.trim().split(/\r?\n/).reverse()) {
			if (!line.trim()) continue;
			try {
				return JSON.parse(line) as unknown;
			} catch {
				// Herdr may include plain terminal output before its JSON response.
			}
		}
	}
	return undefined;
}

function errorText(value: unknown, stderr: string, exitCode: number | null): string {
	if (value && typeof value === "object" && "error" in value) {
		const error = (value as { error?: { code?: unknown; message?: unknown } }).error;
		return `${String(error?.code ?? "herdr_error")}: ${String(error?.message ?? "Herdr command failed")}`;
	}
	return stderr.trim() || `Herdr exited with code ${exitCode ?? "unknown"}.`;
}

export class HerdrClient {
	private readonly binary: string;

	constructor(binary = process.env.HERDR_BIN?.trim() || "herdr") {
		this.binary = binary;
	}

	async run<T = unknown>(args: string[], options: RunOptions = {}): Promise<T> {
		return await new Promise<T>((resolve, reject) => {
			let settled = false;
			let stdout = "";
			let stderr = "";
			const child = spawn(this.binary, args, {
				shell: false,
				windowsHide: true,
				env: process.env,
			});
			const finish = (callback: () => void) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				options.signal?.removeEventListener("abort", abort);
				callback();
			};
			const abort = () => {
				try { child.kill("SIGTERM"); } catch {}
				finish(() => reject(new Error(`Herdr command aborted: ${args.join(" ")}`)));
			};
			const timeoutMs = options.timeoutMs ?? 20_000;
			const timer = setTimeout(() => {
				try { child.kill("SIGTERM"); } catch {}
				finish(() => reject(new Error(`Herdr command timed out after ${timeoutMs}ms: ${args.join(" ")}`)));
			}, timeoutMs);
			timer.unref?.();

			if (options.signal?.aborted) abort();
			else options.signal?.addEventListener("abort", abort, { once: true });
			child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
			child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
			child.on("error", (error) => finish(() => reject(error)));
			child.on("close", (code) => {
				finish(() => {
					const envelope = parseEnvelope(stdout, stderr);
					if (code !== 0 || (envelope && typeof envelope === "object" && "error" in envelope)) {
						reject(new Error(errorText(envelope, stderr, code)));
						return;
					}
					if (envelope && typeof envelope === "object" && "result" in envelope) {
						resolve((envelope as { result: T }).result);
					} else {
						resolve((envelope ?? {}) as T);
					}
				});
			});
		});
	}

	async createTab(input: { workspaceId: string; cwd: string; label: string; env: Record<string, string>; focus?: boolean; signal?: AbortSignal }): Promise<HerdrTab> {
		const args = ["tab", "create", "--workspace", input.workspaceId, "--cwd", input.cwd, "--label", input.label, input.focus ? "--focus" : "--no-focus"];
		for (const [name, value] of Object.entries(input.env)) args.push("--env", `${name}=${value}`);
		const result = await this.run<{
			tab?: { tab_id?: string };
			root_pane?: { pane_id?: string };
		}>(args, { signal: input.signal });
		const tabId = result.tab?.tab_id;
		const paneId = result.root_pane?.pane_id;
		if (!tabId || !paneId) throw new Error("Herdr tab create returned no tab or root pane id.");
		return { tabId, paneId };
	}

	async startPi(input: { name: string; paneId: string; args: string[]; signal?: AbortSignal }): Promise<void> {
		await this.run(
			["agent", "start", input.name, "--kind", "pi", "--pane", input.paneId, "--timeout", "30000", "--", ...input.args],
			{ signal: input.signal, timeoutMs: 40_000 },
		);
	}

	async delegate(input: { target: string; timeoutMs: number; signal?: AbortSignal }): Promise<void> {
		await this.run(
			["agent", "prompt", input.target, "/herdr-delegate", "--wait", "--timeout", String(input.timeoutMs)],
			{ signal: input.signal, timeoutMs: input.timeoutMs + 10_000 },
		);
	}

	async closeTab(tabId: string): Promise<void> {
		try {
			await this.run(["tab", "close", tabId], { timeoutMs: 10_000 });
		} catch (error) {
			if (!/not.?found|gone/i.test(error instanceof Error ? error.message : String(error))) throw error;
		}
	}
}

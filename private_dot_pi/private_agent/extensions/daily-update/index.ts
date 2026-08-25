import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { uuidv7 } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { profileSelectionFromEntries } from "../shared/profile-registry.ts";
import { collectDailyWorkEvidence, type DailyWorkEvidence } from "./collect-sessions.ts";
import { buildDailyUpdatePrompt, normalizeDailyUpdateDraft, resolveDateSelection } from "./prompt.ts";
import { activeProfileModelError } from "./profile-policy.ts";

const CACHE_DIR = join(
	process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"),
	"cache",
	"daily-update",
);

export default function dailyUpdate(pi: ExtensionAPI): void {
	if (process.env.HERDR_SUBAGENT_CHILD === "1") return;

	pi.registerCommand("daily-update", {
		description: "Draft a Slack-ready update from work-profile Pi sessions",
		getArgumentCompletions: (prefix: string) => ["today", "yesterday", "previous-workday"]
			.filter((value) => value.startsWith(prefix.trim()))
			.map((value) => ({ value, label: value })),
		handler: async (args, ctx) => {
			try {
				await runDailyUpdate(args, ctx);
			} catch (error) {
				notify(ctx, error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}

async function runDailyUpdate(args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (ctx.mode !== "tui") {
		throw new Error("/daily-update currently requires interactive Pi mode.");
	}
	await ctx.waitForIdle();
	const profile = profileSelectionFromEntries(ctx.sessionManager.getBranch());
	if (profile !== "work") {
		throw new Error(`Switch to the work profile before generating an update. Current profile: ${profile ?? "unmarked"}.`);
	}
	const model = ctx.model;
	if (!model) throw new Error("The work profile has no active model.");
	const modelIssue = activeProfileModelError("work", model.provider, model.id);
	if (modelIssue) throw new Error(modelIssue);
	if (!ctx.modelRegistry.hasConfiguredAuth(model)) {
		throw new Error(`The active work model '${model.provider}/${model.id}' is not authenticated.`);
	}

	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
	const selection = resolveDateSelection(args, { timeZone });
	notify(ctx, `Collecting work evidence for ${selection.date}…`);
	const evidence = collectDailyWorkEvidence({
		date: selection.date,
		timeZone,
		profile: "work",
	});
	const paths = writeEvidenceArtifact(evidence);
	if (evidence.tasks.length === 0) {
		notify(ctx, `No evidenced work activity found for ${selection.date}. Evidence saved to ${paths.evidencePath}.`, "warning");
		return;
	}

	notify(ctx, `Drafting from ${evidence.tasks.length} evidenced task${evidence.tasks.length === 1 ? "" : "s"}…`);
	const response = await ctx.modelRegistry.complete(
		model,
		{
			messages: [{
				role: "user",
				content: [{ type: "text", text: buildDailyUpdatePrompt(evidence, selection.weekday) }],
				timestamp: Date.now(),
			}],
		},
		{
			reasoningEffort: "high",
			cacheRetention: "none",
			sessionId: uuidv7(),
		},
	);
	if (response.stopReason === "error") {
		throw new Error(response.errorMessage ?? "The work model could not generate a daily update.");
	}
	const generated = normalizeDailyUpdateDraft(responseText(response.content), selection.weekday);
	writePrivateFile(paths.draftPath, `${generated}\n`);
	const edited = await ctx.ui.editor(`Daily update for ${selection.date}`, generated);
	if (edited === undefined) {
		notify(ctx, `Draft saved to ${paths.draftPath}.`);
		return;
	}
	const finalDraft = edited.trim();
	if (!finalDraft) {
		notify(ctx, `Empty edit discarded; generated draft remains at ${paths.draftPath}.`, "warning");
		return;
	}
	writePrivateFile(paths.draftPath, `${finalDraft}\n`);
	copyWithOsc52(finalDraft);
	notify(ctx, `Daily update copied to the clipboard and saved to ${paths.draftPath}.`);
}

function writeEvidenceArtifact(evidence: DailyWorkEvidence): { evidencePath: string; draftPath: string } {
	mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
	chmodSync(CACHE_DIR, 0o700);
	const evidencePath = join(CACHE_DIR, `${evidence.date}.evidence.json`);
	const draftPath = join(CACHE_DIR, `${evidence.date}.md`);
	writePrivateFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
	return { evidencePath, draftPath };
}

function writePrivateFile(path: string, content: string): void {
	const temporary = `${path}.${process.pid}.tmp`;
	writeFileSync(temporary, content, { mode: 0o600 });
	renameSync(temporary, path);
	chmodSync(path, 0o600);
}

function responseText(content: unknown): string {
	if (!Array.isArray(content)) return "";
	return content
		.flatMap((part) => part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part
			? [String(part.text)]
			: [])
		.join("\n")
		.trim();
}

function copyWithOsc52(value: string): void {
	process.stdout.write(`\x1b]52;c;${Buffer.from(value).toString("base64")}\x07`);
}

function notify(
	ctx: ExtensionCommandContext,
	message: string,
	type: "info" | "warning" | "error" = "info",
): void {
	if (ctx.hasUI) ctx.ui.notify(message, type);
}

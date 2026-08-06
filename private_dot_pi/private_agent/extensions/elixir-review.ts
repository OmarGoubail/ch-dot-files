/**
 * Elixir Review — review memory helpers and prompt generation.
 *
 * Auto-discovered from ~/.pi/agent/extensions/elixir-review.ts and reloadable with /reload.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

const KNOWLEDGE_ROOT = process.env.QMD_KNOWLEDGE_ROOT ?? join(homedir(), "Documents", "knowledge");
const QMD_COLLECTION = "knowledge";
const GLOBAL_PATTERN_FILE = join("topics", "reviewer-patterns.md");
const REVIEW_PATTERN_DIR = "review-patterns";
const REVIEW_REFLECTION_DIR = "review-reflections";


function gitRoot(cwd: string): string | undefined {
	try {
		return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
	} catch {
		return undefined;
	}
}

function projectRoot(cwd: string): string {
	return gitRoot(cwd) || cwd;
}

function repoSlug(cwd: string): string {
	const root = projectRoot(cwd);
	return slugify(basename(root) || "repo");
}

function repoPatternDir(cwd: string): string {
 const path = join("projects", repoSlug(cwd), REVIEW_PATTERN_DIR);
 return path;
}

function repoReflectionDir(cwd: string): string {
 return join("projects", repoSlug(cwd), REVIEW_REFLECTION_DIR);
}

function knowledgePath(relativePath: string): string {
 return join(KNOWLEDGE_ROOT, relativePath);
}

function qmdUri(relativePath: string): string {
 return `qmd://${QMD_COLLECTION}/${relativePath.replaceAll("\\", "/")}`;
}

function hasFile(path: string): boolean {
 return existsSync(path);
}

function runQmd(args: string[]): string {
 return execFileSync("qmd", args, {
  cwd: KNOWLEDGE_ROOT,
  encoding: "utf-8",
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  maxBuffer: 2_000_000,
 });
}

function qmdCollectionStatus(): string {
 if (!existsSync(KNOWLEDGE_ROOT)) return "knowledge root missing";

 try {
  const output = runQmd(["collection", "list"]);
  return output.includes(`${QMD_COLLECTION} (`) ? "registered" : "collection not registered";
 } catch {
  return "qmd unavailable";
 }
}

function globalPatternPaths(): string[] {
 return [GLOBAL_PATTERN_FILE, join("topics", REVIEW_PATTERN_DIR, "*.md")];
}

function repoPatternPaths(cwd: string): string[] {
 const directory = repoPatternDir(cwd);
 return [join("projects", repoSlug(cwd), "review-patterns.md"), join(directory, "*.md")];
}

function memoryStatus(cwd: string) {
 const root = projectRoot(cwd);
 const slug = repoSlug(cwd);
 const repoPatterns = repoPatternPaths(cwd);
 return {
  cwd,
  root,
  knowledgeRoot: KNOWLEDGE_ROOT,
  qmdStatus: qmdCollectionStatus(),
  repoSlug: slug,
  globalPatternFile: knowledgePath(GLOBAL_PATTERN_FILE),
  globalPatternUri: qmdUri(GLOBAL_PATTERN_FILE),
  repoPatternDir: knowledgePath(repoPatternDir(cwd)),
  repoPatternUri: qmdUri(repoPatternDir(cwd)),
  repoPatternPaths: repoPatterns.map(qmdUri),
  mixProjects: findMixProjects(root),
  isElixir: detectElixir(root),
  isJump: detectJump(root),
 };
}

function findMixProjects(root: string): string[] {
	const found: string[] = [];
	try {
		const output = execFileSync("find", [root, "-path", "*/deps", "-prune", "-o", "-name", "mix.exs", "-print"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		for (const file of output.split("\n").filter(Boolean)) {
			found.push(file);
			if (found.length >= 8) break;
		}
	} catch {}
	return found;
}

function detectElixir(root: string): boolean {
	return findMixProjects(root).length > 0;
}

function detectJump(root: string): boolean {
	const obviousFiles = ["mix.exs", "README.md", join("config", "config.exs")];
	for (const file of obviousFiles) {
		const path = join(root, file);
		if (!existsSync(path)) continue;
		try {
			if (/\bJump(Web)?\b|jump[-_]?app|jump/i.test(readFileSync(path, "utf-8"))) return true;
		} catch {}
	}

	try {
		const output = execFileSync("rg", ["-i", "--files-with-matches", "\\bJump(Web)?\\b|jump[-_]?app", "mix.exs", "config", "lib", "test"], {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		return output.length > 0;
	} catch {
		return false;
	}
}


function statusText(cwd: string): string {
 const s = memoryStatus(cwd);
 return [
  "Elixir review memory status",
  `cwd: ${s.cwd}`,
  `project root: ${s.root}`,
  `Elixir repo: ${s.isElixir ? "yes" : "no"}`,
  ...(s.mixProjects.length > 0 ? [`Mix projects: ${s.mixProjects.map((p) => p.startsWith(s.root) ? p.slice(s.root.length + 1) : p).join(", ")}${s.mixProjects.length >= 8 ? ", ..." : ""}`] : [`Mix projects: none found under ${s.root}`]),
  `Jump signals: ${s.isJump ? "yes" : "no"}`,
  "",
  "QMD review memory:",
  `- knowledge root: ${s.knowledgeRoot}`,
  `- collection: ${s.qmdStatus}`,
  `- global patterns: ${s.globalPatternFile}: ${hasFile(s.globalPatternFile) ? "found" : "missing"}`,
  `- repo patterns: ${s.repoPatternDir}/: ${hasFile(s.repoPatternDir) ? "found" : "missing"}`,
  "",
  "QMD is the source of truth; pattern and reflection writes create new Markdown notes and refresh the index.",
 ].join("\n");
}

function usage(): string {
	return [
		"/elixir-review — Elixir PR review + memory helper",
		"",
		"Typical workflow:",
		"  1. /elixir-review status",
		"     Check whether this repo looks like Elixir/Jump and whether memory exists.",
		"  2. /elixir-review init",
		"     Verify the QMD knowledge vault and collection used for review memory.",
		"  3. /elixir-review prompt current changes",
		"     Puts a ready review request in the editor. Submit it to run a focused reviewer with the Elixir skills.",
		"  4. /elixir-review learn PR-1234",
		"     After human feedback, put a learning prompt in the editor that may persist durable review-memory entries.",
		"",
		"Commands:",
		"  /elixir-review help                Show this help",
		"  /elixir-review status              Show QMD memory and repo detection",
		"  /elixir-review init                Verify the QMD knowledge vault and collection",
		"  /elixir-review prompt [scope]      Put a ready review prompt in the editor",
		"  /elixir-review learn <PR-or-label> Put a memory-learning prompt in the editor",
		"",
		"Examples:",
		"  /elixir-review prompt current changes",
		"  /elixir-review prompt PR 1234",
		"  /elixir-review learn PR 1234",
		"",
		"Current limits:",
		"  The extension does not post PR comments or mutate reviewed code. Normal /elixir-review prompt reviews read memory only; durable memory writes require /elixir-review learn or another explicit persistence request.",
	].join("\n");
}

function nextStepsText(): string {
	return [
		"Next steps:",
		"- Run `/elixir-review status` to confirm memory paths and Elixir/Jump detection.",
		"- Run `/elixir-review prompt current changes` when you want a skilled review of your working diff.",
		"- Run `/elixir-review learn PR 1234` after human PR feedback to start capturing durable lessons.",
	].join("\n");
}

function reviewPrompt(scope = "current changes", cwd = process.cwd()): string {
	const prMatch = scope.match(/\bPR\s+(\d+)\b/i) || scope.match(/^\s*(\d+)\s*$/);
	const prNumber = prMatch?.[1];
	const scopeInstructions = prNumber
		? `PR NUMBER MODE — do not assume the current branch is PR ${prNumber}.
\n
First resolve the PR with read-only GitHub CLI commands, including human review context:
\n
\`\`\`bash
mkdir -p /tmp/pi-elixir-review
gh pr view ${prNumber} --json number,title,body,baseRefName,headRefName,headRepositoryOwner,headRepository,state,url,author,additions,deletions,changedFiles,reviews,comments > /tmp/pi-elixir-review/pr-${prNumber}-meta.json
gh pr diff ${prNumber} > /tmp/pi-elixir-review/pr-${prNumber}.patch
gh pr diff ${prNumber} --name-only > /tmp/pi-elixir-review/pr-${prNumber}-files.txt
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/$REPO/pulls/${prNumber}/comments" --paginate > /tmp/pi-elixir-review/pr-${prNumber}-review-comments.json
gh api "repos/$REPO/issues/${prNumber}/comments" --paginate > /tmp/pi-elixir-review/pr-${prNumber}-issue-comments.json
\`\`\`
\n
Read the human reviews and comments before reviewing. They are first-class context: surface explicit requests for tests or changes under Human review context, even when non-blocking.
\n
Compare the PR metadata with the current worktree:
\n
\`\`\`bash
git branch --show-current
git rev-parse --show-toplevel
git status --short
git diff --name-only main...HEAD || true
\`\`\`
\n
If the checked-out branch/head does not match PR ${prNumber}, use /tmp/pi-elixir-review/pr-${prNumber}.patch as the source of truth and state that local checks may be skipped. Never silently substitute main...HEAD for the PR. Ask before checking out or mutating the worktree.`
		: `CURRENT-CHANGES MODE — inspect the checked-out worktree. State the branch and exact diff range, normally \`git diff main...HEAD\` plus uncommitted changes if present.`;
	return `Review ${scope} as an Elixir/Phoenix PR review.
\n
${scopeInstructions}
\n
Delegate the review to one reviewer by default:
\n
subagent({ agent: "reviewer", task: "Inspect the exact PR patch/source or local diff above. Read repository instructions (AGENTS.md, CLAUDE.md, and equivalent), mix.exs aliases, CI/check scripts, and relevant code. Run safe, relevant project-native checks and report every verified finding with evidence. Use the baseline Elixir review skill and read-only review memory; route Jump-specific checks only when the repository is verified as Jump.", skill: "elixir-pr-review,elixir-review-memory" })
\n
Use one reviewer by default. Add an optional second reviewer only when independent high-risk coverage is warranted by security-, data-, deploy-, or otherwise materially risky behavior; give it the same source of truth and use only the baseline skill plus read-only memory, adding jump-elixir-review only for a verified Jump repo. Do not fan out automatically.
\n
Checks: read repo instructions and discovered aliases/scripts first. Run required and relevant native checks (for example format, compile, Credo, mix jump.ci.lint, and targeted tests) when available and safe. For a PR patch not checked out locally, use patch-only review and mark local checks skipped, or ask before creating/checking out a worktree. List every relevant check as passed, failed, or skipped with its reason.
\n
	Memory: use the QMD-backed review_memory read action for global and repo scopes. The canonical global note is ${qmdUri(GLOBAL_PATTERN_FILE)}; repo-specific notes are under ${qmdUri(repoPatternDir(cwd))}/. Treat memory as a verification lens, not proof. Ordinary reviews are read-only: do not call append_pattern or write_reflection. Those writes require explicit /elixir-review learn (or another explicit persistence request). State whether memory was consulted.
\n
Return one consolidated review with exact file:line or file:start-end references whenever possible; derive patch-only locations from hunks. Do not suppress verified advisory findings, coverage gaps, or human-requested changes. If a location is unstable, use line unknown and explain why. Use this format:
\n
Reviewed source: <PR via gh diff | checked-out matching PR branch | local diff range>
Verdict: <Approved | Changes requested>
\n
Review lens:
- Assigned lens: <baseline and any focused lens>
- Looked for: <issue classes checked>
- Out of scope: <areas not required by changed files>
\n
Review evidence:
- Source inspected: <patch/files/diff range>
- Instructions/config read: <repo guidance, aliases, CI>
- Local patterns checked: <relevant conventions>
- Verified true: <established facts>
- Not verified: <important checks skipped and why>
\n
Checks:
- <command with cwd> — pass/fail/skipped and why
\n
Blocking findings:
- [blocking] path/to/file.ex:42 — <verified issue, impact, and minimal fix>.
- None.
\n
Non-blocking findings:
- [medium|low|info] path/to/file.ex:42 — <advisory issue, coverage gap, human-requested change, or risk>.
- None.
\n
Human review context:
- <unresolved human comments and whether this review agrees, disagrees, or could not verify>
\n
Memory: <consulted or not present>
Residual risks: <meaningful risks not captured above, or none>`;
}

function slugify(input: string): string {
 return input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "unknown";
}

function oneLine(input: string, maxLength = 120): string {
 return input.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function redactSecrets(text: string): string {
 return text
  .replace(/\b(?:sk|ghp|github_pat|glpat|xox[baprs])[-_][A-Za-z0-9_-]+\b/g, "[REDACTED_SECRET]")
  .replace(/\bAIza[0-9A-Za-z_-]+\b/g, "[REDACTED_SECRET]")
  .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_SECRET]")
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED_SECRET]")
  .replace(/((?:api[_ -]?key|token|password|secret)\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED_SECRET]");
}

function prNumberFromLabel(label: string): string | undefined {
	return label.match(/^\s*(?:PR[-\s#]*|#)?(\d+)\s*$/i)?.[1];
}

function reflectionTemplate(label: string): string {
	return `# ${label} Review Reflection

## Human Feedback Summary
- <comment/finding distilled>

## What We Missed
- <missed issue or convention>

## Root Cause
- <why it was missed>

## Future Review Pattern
- Rule: <one sentence>
- Detection: <how to find it next time>
- Skill: <elixir-pr-review|elixir-review-memory|jump-elixir-review>

## Sources
- <reviewer/comment/file links or local references>
`;
}

function learningPrompt(cwd: string, label: string): string {
	const s = memoryStatus(cwd);
	const prNumber = prNumberFromLabel(label);
	const sourceInstructions = prNumber
		? `PR NUMBER MODE — learn from human review feedback for PR ${prNumber}.

Use read-only GitHub CLI commands to fetch review context; do not checkout, push, edit files, or post comments for this learning pass:

\`\`\`bash
mkdir -p /tmp/pi-elixir-review
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh pr view ${prNumber} --json number,title,body,url,author,baseRefName,headRefName,headRepositoryOwner,headRepository,state,reviews,comments > /tmp/pi-elixir-review/pr-${prNumber}-meta.json
gh pr diff ${prNumber} > /tmp/pi-elixir-review/pr-${prNumber}.patch
gh api "repos/$REPO/pulls/${prNumber}/comments" --paginate > /tmp/pi-elixir-review/pr-${prNumber}-review-comments.json
gh api "repos/$REPO/issues/${prNumber}/comments" --paginate > /tmp/pi-elixir-review/pr-${prNumber}-issue-comments.json
\`\`\`

Filter bots and automation before learning: ignore comments/reviews whose author/user is a bot/app, whose login ends with [bot], or that are generated by CI unless the user explicitly asks to learn from them. Compare human comments with the PR diff, prior review output in this conversation, and any relevant existing review memory. Distill only durable, reusable lessons and persist only non-sensitive summaries or source links; do not copy secrets, customer data, private tokens, or unnecessary confidential PR text.`
		: `NON-PR LABEL MODE — learn from human feedback labeled "${label}".

Use human feedback pasted in this conversation or editor as the source of truth. Do not fetch GitHub context unless the user supplies a PR number or explicitly asks you to. Compare the pasted feedback with any available review/diff context and existing review memory. Distill only durable, reusable lessons and persist only non-sensitive summaries or source links; do not copy secrets, customer data, private tokens, or unnecessary confidential text.`;

	return `Learn durable Elixir/Phoenix PR review lessons for ${label}.

${sourceInstructions}

	QMD-backed review memory for this learning workflow:
	- Knowledge vault: ${s.knowledgeRoot}
	- QMD collection: ${s.qmdStatus}
	- Global patterns: ${s.globalPatternUri} and ${qmdUri(join("topics", REVIEW_PATTERN_DIR))}/
	- Current repo patterns: ${s.repoPatternUri}/
	- New notes are written to the knowledge repository and indexed with QMD; existing notes are never overwritten.

	Persistence approval:
	- Invoking /elixir-review learn ${label} is explicit user approval to persist durable review-memory entries for this learning task.
	- You may call review_memory append_pattern and write_reflection. These actions create new QMD Markdown notes and refresh the QMD index.
	- Ordinary /elixir-review prompt reviews must not write memory unless the user explicitly asks to learn/persist.

What to persist:
- Repo-specific reviewer/project preferences go to scope repo.
- Generally reusable Elixir/Phoenix lessons may go to scope global.
- Use scope both only when the exact same pattern belongs in both places.
- Write no pattern if there is no durable lesson.
- Keep entries concise, actionable, and framed as future review checks.

Suggested workflow:
1. Read existing memory with review_memory read.
2. Gather human feedback using the mode above and filter out bots/automation.
3. Compare each human point against the review/diff context: was it missed, underweighted, already caught, or not durable?
4. For each durable lesson, call review_memory append_pattern with scope repo/global/both and a short markdown pattern.
5. If there is meaningful feedback to record, call review_memory write_reflection with label ${JSON.stringify(label)} and reflection markdown like:

${reflectionTemplate(label)}

6. If there are no durable lessons, write no pattern; optionally write a brief reflection only if it helps explain why nothing should be learned.`;
}

function qmdMemoryPaths(cwd: string, scope: "global" | "repo" | "both"): string[] {
 const paths = [
  ...(scope === "global" || scope === "both" ? globalPatternPaths() : []),
  ...(scope === "repo" || scope === "both" ? repoPatternPaths(cwd) : []),
 ];
 return [...new Set(paths)];
}

function readQmdMemory(cwd: string, scope: "global" | "repo" | "both"): string {
 const status = qmdCollectionStatus();
 if (status !== "registered") {
  return `QMD review memory unavailable: collection '${QMD_COLLECTION}' is ${status}.`;
 }

 const documents = qmdMemoryPaths(cwd, scope)
  .map((path) => {
   try {
    return runQmd(["multi-get", qmdUri(path), "--format", "md", "--no-line-numbers", "-l", "240", "--max-bytes", "50000"]).trim();
   } catch {
    return "";
   }
  })
  .filter(Boolean);

 if (documents.length === 0) {
  return `No QMD review pattern notes found for scope '${scope}'.`;
 }

 return [`QMD review memory (${scope})`, ...documents].join("\n\n---\n\n");
}

function ensureQmdCollection(): void {
 const status = qmdCollectionStatus();
 if (status !== "registered") {
  throw new Error(`QMD collection '${QMD_COLLECTION}' is ${status}; register ${KNOWLEDGE_ROOT} before writing review memory.`);
 }
}

function uniqueKnowledgePath(directory: string, baseName: string): string {
 mkdirSync(knowledgePath(directory), { recursive: true });
 let suffix = 1;
 let relativePath = join(directory, `${baseName}.md`);
 while (existsSync(knowledgePath(relativePath))) {
  suffix += 1;
  relativePath = join(directory, `${baseName}-${suffix}.md`);
 }
 return relativePath;
}

function noteContent(title: string, type: "review-pattern" | "review-reflection", scope: "global" | "repo", cwd: string, body: string): string {
 const metadata = [
  "---",
  `title: ${JSON.stringify(oneLine(title))}`,
  `type: ${JSON.stringify(type)}`,
  `status: "active"`,
  `scope: ${JSON.stringify(scope)}`,
  ...(scope === "repo" ? [`project: ${JSON.stringify(repoSlug(cwd))}`] : []),
  `created_at: ${JSON.stringify(new Date().toISOString())}`,
  `source: "pi-elixir-review"`,
  "---",
 ];
 return `${metadata.join("\n")}\n\n${body.trim()}\n`;
}

function writePattern(cwd: string, pattern: string, scope: "global" | "repo" | "both"): string[] {
 ensureQmdCollection();
 const safePattern = redactSecrets(pattern.trim());
 const date = new Date().toISOString().slice(0, 10);
 const scopes = scope === "both" ? ["global", "repo"] : [scope];

 return scopes.map((targetScope) => {
  const directory = targetScope === "global" ? join("topics", REVIEW_PATTERN_DIR) : repoPatternDir(cwd);
  const baseName = `${date}-${slugify(safePattern)}`;
  const relativePath = uniqueKnowledgePath(directory, baseName);
  const title = `Review Pattern: ${oneLine(safePattern)}`;
  const content = noteContent(title, "review-pattern", targetScope, cwd, `# ${title}\n\n${safePattern}`);
  writeFileSync(knowledgePath(relativePath), content, { encoding: "utf-8", flag: "wx" });
  return qmdUri(relativePath);
 });
}

function writeReflection(cwd: string, label: string, reflection: string, scope: "global" | "repo" | "both"): string {
 ensureQmdCollection();
 const targetScope = scope === "global" ? "global" : "repo";
 const safeLabel = redactSecrets(label.trim());
 const directory = targetScope === "global" ? join("topics", REVIEW_REFLECTION_DIR) : repoReflectionDir(cwd);
 const baseName = `${new Date().toISOString().slice(0, 10)}-${slugify(safeLabel)}`;
 const relativePath = uniqueKnowledgePath(directory, baseName);
 const content = noteContent(`Review Reflection: ${safeLabel}`, "review-reflection", targetScope, cwd, redactSecrets(reflection.trim()));
 writeFileSync(knowledgePath(relativePath), content, { encoding: "utf-8", flag: "wx" });
 return qmdUri(relativePath);
}

function refreshQmd(): string | undefined {
 try {
  runQmd(["update"]);
  runQmd(["embed", "-c", QMD_COLLECTION]);
  return undefined;
 } catch (error) {
  return String(error);
 }
}

function notifyOrDisplay(pi: ExtensionAPI, ctx: ExtensionCommandContext, content: string, title = "Elixir Review") {
	// Display as a normal transcript-style custom message. Do not use deliverAs: "nextTurn";
	// that queues the message into future prompts.
	pi.sendMessage({ customType: "elixir-review", content, display: true, details: { title } });
	ctx.ui.notify(title, "info");
}

function displayMessage(pi: ExtensionAPI, ctx: ExtensionCommandContext, content: string, title = "Elixir Review") {
	pi.sendMessage({ customType: "elixir-review", content, display: true, details: { title } });
	ctx.ui.notify(title, "info");
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("elixir-review", {
		description: "Elixir review memory and prompt helper",
		getArgumentCompletions: (prefix: string) => {
			// Only complete the subcommand, never arguments. Returning fallback items for
			// `prompt 16905` can replace the user's args with `help` in the command UI.
			if (prefix.trim().includes(" ")) return [];
			const items = ["help", "status", "init", "prompt", "learn"].map((value) => ({ value, label: value }));
			return items.filter((item) => item.value.startsWith(prefix.trim()));
		},
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			const [subcommand, ...rest] = trimmed.split(/\s+/).filter(Boolean);

			if (!subcommand || subcommand === "help") {
				notifyOrDisplay(pi, ctx, usage());
				return;
			}

			if (subcommand === "status") {
				notifyOrDisplay(pi, ctx, statusText(ctx.cwd));
				return;
			}

			if (subcommand === "init") {
				const s = memoryStatus(ctx.cwd);
				const message = [
					s.qmdStatus === "registered" ? "QMD review memory is ready." : `QMD review memory is not ready: ${s.qmdStatus}.`,
					"",
					`Knowledge vault: ${s.knowledgeRoot}`,
					`Global patterns: ${s.globalPatternUri}`,
					`Current repo patterns: ${s.repoPatternUri}/`,
					"",
					nextStepsText(),
				].join("\n");
				notifyOrDisplay(pi, ctx, message);
				return;
			}

			if (subcommand === "prompt") {
				const rawScope = rest.join(" ").trim();
				const scope = rawScope ? (/^\d+$/.test(rawScope) ? `PR ${rawScope}` : rawScope) : "current changes";
				const prompt = reviewPrompt(scope, ctx.cwd);
				ctx.ui.setEditorText(prompt);
				displayMessage(pi, ctx, "Review prompt placed in editor. Submit it to run the review.");
				return;
			}

			if (/^\d+$/.test(subcommand)) {
				const prompt = reviewPrompt(`PR ${subcommand}`, ctx.cwd);
				ctx.ui.setEditorText(prompt);
				displayMessage(pi, ctx, "Review prompt placed in editor. Submit it to run the review.");
				return;
			}

			if (subcommand === "learn") {
				const label = rest.join(" ").trim();
				if (!label) {
					notifyOrDisplay(pi, ctx, "Usage: /elixir-review learn <PR-or-label>");
					return;
				}
				ctx.ui.setEditorText(learningPrompt(ctx.cwd, label));
				displayMessage(pi, ctx, "Learning prompt placed in editor. Submit it to persist durable review-memory entries if warranted.");
				return;
			}

			notifyOrDisplay(pi, ctx, `Unknown subcommand: ${subcommand}\n\n${usage()}`);
		},
	});

	pi.registerTool({
		name: "review_memory",
		label: "Review Memory",
		description: "Read QMD-backed review memory or explicitly persist new QMD notes.",
		promptSnippet: "Read QMD-backed Elixir review memory, or create new QMD notes only after explicit persistence approval.",
		promptGuidelines: [
			"Ordinary reviews may use review_memory status/read only.",
			"Use append_pattern or write_reflection only after /elixir-review learn or another explicit user persistence request.",
			"Persist concise, non-sensitive reusable lessons as new QMD Markdown notes; never overwrite existing notes.",
		],
		parameters: Type.Object({
			action: Type.Union([Type.Literal("status"), Type.Literal("read"), Type.Literal("append_pattern"), Type.Literal("write_reflection")]),
			scope: Type.Optional(Type.Union([Type.Literal("global"), Type.Literal("repo"), Type.Literal("both")])),
			pattern: Type.Optional(Type.String({ description: "Markdown pattern text for a new QMD note." })),
			label: Type.Optional(Type.String({ description: "PR number or label for a reflection note." })),
			reflection: Type.Optional(Type.String({ description: "Markdown reflection text for a new QMD note." })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const readScope = params.scope || "both";

			if (params.action === "status") {
				return { content: [{ type: "text", text: statusText(ctx.cwd) }], details: {} };
			}

			if (params.action === "read") {
				return {
					content: [{ type: "text", text: readQmdMemory(ctx.cwd, readScope) }],
					details: { scope: readScope, source: "qmd" },
				};
			}

			if (params.action === "write_reflection") {
				if (!params.label?.trim() || !params.reflection?.trim()) {
					return { content: [{ type: "text", text: "write_reflection requires label and reflection text." }], details: { error: "missing_reflection" } };
				}

				try {
					const reflectionScope = params.scope === "global" ? "global" : "repo";
					const path = writeReflection(ctx.cwd, params.label.trim(), params.reflection.trim(), reflectionScope);
					const refreshError = refreshQmd();
					const suffix = refreshError ? ` QMD refresh failed: ${refreshError}` : " QMD index refreshed.";
					return { content: [{ type: "text", text: `Wrote reflection to ${path}.${suffix}` }], details: { path, scope: reflectionScope, refreshError } };
				} catch (error) {
					return { content: [{ type: "text", text: `Could not write reflection: ${String(error)}` }], details: { error: "write_failed" } };
				}
			}

			if (!params.pattern?.trim()) {
				return { content: [{ type: "text", text: "append_pattern requires pattern text." }], details: { error: "missing_pattern" } };
			}

			try {
				const appendScope = params.scope || "repo";
				const paths = writePattern(ctx.cwd, params.pattern.trim(), appendScope);
				const refreshError = refreshQmd();
				const suffix = refreshError ? ` QMD refresh failed: ${refreshError}` : " QMD index refreshed.";
				return { content: [{ type: "text", text: `Wrote new review pattern note(s) to ${paths.join(", ")}.${suffix}` }], details: { paths, scope: appendScope, refreshError } };
			} catch (error) {
				return { content: [{ type: "text", text: `Could not write review pattern: ${String(error)}` }], details: { error: "write_failed" } };
			}
		},
	});
}

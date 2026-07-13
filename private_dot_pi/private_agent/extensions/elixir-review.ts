/**
 * Elixir Review — review memory helpers and prompt generation.
 *
 * Auto-discovered from ~/.pi/agent/extensions/elixir-review.ts and reloadable with /reload.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

const GLOBAL_MEMORY_DIR = join(homedir(), ".pi", "review-memory");
const PROJECT_MEMORY_REL = join(".pi", "review-memory"); // Legacy path only; MVP stores memory globally in ~/.pi/review-memory.

function expandHome(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path;
}

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

function repoMemoryDir(cwd: string): string {
	// Repo-specific memory is stored centrally under ~/.pi, not inside the repo.
	return join(GLOBAL_MEMORY_DIR, "repos", repoSlug(cwd));
}

function hasFile(path: string): boolean {
	return existsSync(path);
}

function memoryStatus(cwd: string) {
	const root = projectRoot(cwd);
	const globalDir = expandHome(GLOBAL_MEMORY_DIR);
	const repoDir = repoMemoryDir(cwd);
	return {
		cwd,
		root,
		globalDir,
		repoSlug: repoSlug(cwd),
		repoDir,
		legacyProjectDir: join(root, PROJECT_MEMORY_REL),
		globalPatternsMd: join(globalDir, "patterns.md"),
		globalPatternsJson: join(globalDir, "patterns.json"),
		globalPrs: join(globalDir, "prs"),
		repoPatternsMd: join(repoDir, "patterns.md"),
		repoPatternsJson: join(repoDir, "patterns.json"),
		repoPrs: join(repoDir, "prs"),
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

function patternsMarkdown(scope = "Global"): string {
	return `# ${scope} Review Memory Patterns

## Generally Useful Patterns
- Pattern: <short rule>
  - Applies when: <scope>
  - Source repo: <repo/app name>
  - Evidence: <PR/comment/source>
  - Reviewer action: <what to check next time>

## Repo-Specific Conventions
- Pattern: <repo-specific rule>
  - Repo: <repo/app name>
  - Applies when: <scope>
  - Detection: <search/read strategy>
  - Evidence: <file/PR/comment>

## Repeated Misses
- Miss: <what reviewers/developers keep missing>
  - Repo/source: <repo/app name or global>
  - Why it matters: <impact>
  - Detection: <search/read strategy>
  - Example: <file/PR/comment>
`;
}

function ensureMemoryDir(dir: string): string[] {
	const created: string[] = [];
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
		created.push(dir);
	}
	const patternsMd = join(dir, "patterns.md");
	const patternsJson = join(dir, "patterns.json");
	const prs = join(dir, "prs");
	if (!existsSync(patternsMd)) {
		writeFileSync(patternsMd, patternsMarkdown(dir.includes(`${GLOBAL_MEMORY_DIR}/repos/`) ? "Repo-Specific" : "Global"), "utf-8");
		created.push(patternsMd);
	}
	if (!existsSync(patternsJson)) {
		writeFileSync(patternsJson, '{ "patterns": [] }\n', "utf-8");
		created.push(patternsJson);
	}
	if (!existsSync(prs)) {
		mkdirSync(prs, { recursive: true });
		created.push(prs);
	}
	return created;
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
		"Global memory pool (shared generally useful lessons):",
		`- ${s.globalPatternsMd}: ${hasFile(s.globalPatternsMd) ? "found" : "missing"}`,
		`- ${s.globalPatternsJson}: ${hasFile(s.globalPatternsJson) ? "found" : "missing"}`,
		`- ${s.globalPrs}/: ${hasFile(s.globalPrs) ? "found" : "missing"}`,
		"",
		`Current repo memory bucket (${s.repoSlug}, stored centrally under ~/.pi):`,
		`- ${s.repoPatternsMd}: ${hasFile(s.repoPatternsMd) ? "found" : "missing"}`,
		`- ${s.repoPatternsJson}: ${hasFile(s.repoPatternsJson) ? "found" : "missing"}`,
		`- ${s.repoPrs}/: ${hasFile(s.repoPrs) ? "found" : "missing"}`,
		"",
		`Legacy in-repo path not used by init: ${s.legacyProjectDir}`,
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
		"     Run once per machine/repo to create ~/.pi/review-memory plus a central repo bucket under ~/.pi/review-memory/repos/<repo>.",
		"  3. /elixir-review prompt current changes",
		"     Puts a ready review request in the editor. Submit it to run a focused reviewer with the Elixir skills.",
		"  4. /elixir-review learn PR-1234",
		"     After human feedback, put a learning prompt in the editor that may persist durable review-memory entries.",
		"",
		"Commands:",
		"  /elixir-review help                Show this help",
		"  /elixir-review status              Show memory paths and repo detection",
		"  /elixir-review init                Create global pool and current repo bucket under ~/.pi/review-memory",
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

function reviewPrompt(scope = "current changes"): string {
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
subagent({ agent: "reviewer", task: "Inspect the exact PR patch/source or local diff above. Read repository instructions (AGENTS.md, CLAUDE.md, and equivalent), mix.exs aliases, CI/check scripts, and relevant code. Run safe, relevant project-native checks and report every verified finding with evidence. Select focused skills only when changed files require them; do not review unrelated domains.", skill: "elixir-pr-review,elixir-review-memory" })
\n
Use at most two reviewer tasks only when the diff clearly crosses independent domains or is security-, data-, or deploy-sensitive. If a second task is warranted, give it one focused lens and the same source of truth; do not fan out automatically. Available focused skills include elixir-liveview-review, elixir-ecto-review, elixir-testing-review, elixir-security-review, elixir-deploy-risk-review, elixir-maintainability-review, elixir-code-contracts-review, elixir-git-history-review, elixir-prior-comments-review, elixir-adversarial-review, and jump-elixir-review. Add only skills justified by changed files/risk (including prior-comments when human comments need focused review).
\n
Checks: read repo instructions and discovered aliases/scripts first. Run required and relevant native checks (for example format, compile, Credo, mix jump.ci.lint, and targeted tests) when available and safe. For a PR patch not checked out locally, use patch-only review and mark local checks skipped, or ask before creating/checking out a worktree. List every relevant check as passed, failed, or skipped with its reason.
\n
Memory: read ~/.pi/review-memory/patterns.md and ~/.pi/review-memory/repos/<current-repo>/patterns.md when present via review_memory read. Treat memory as a verification lens, not proof. Ordinary reviews are read-only: do not call append_pattern or write_reflection. Those writes require explicit /elixir-review learn (or another explicit persistence request). State whether memory was consulted.
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
- Skill: <elixir-pr-review|elixir-liveview-review|elixir-ecto-review|elixir-testing-review|elixir-security-review|jump-elixir-review>

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

Memory dirs have been initialized for this learning workflow:
- Global reusable pool: ${s.globalDir}
- Current repo bucket: ${s.repoDir}

Persistence approval:
- Invoking /elixir-review learn ${label} is explicit user approval to persist durable review-memory entries for this learning task.
- You may call review_memory append_pattern and review_memory write_reflection. Use those extension-backed actions for memory writes, not generic file writes.
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

function uniqueReflectionPath(dir: string, label: string): string {
	const prsDir = join(dir, "prs");
	mkdirSync(prsDir, { recursive: true });
	const date = new Date().toISOString().slice(0, 10);
	const base = `${date}-${slugify(label)}`;
	let file = join(prsDir, `${base}.md`);
	let n = 2;
	while (existsSync(file)) {
		file = join(prsDir, `${base}-${n}.md`);
		n += 1;
	}
	return file;
}

function writeReflection(cwd: string, label: string, reflection: string, scope?: "global" | "repo" | "both"): string {
	const dir = scope === "global" ? GLOBAL_MEMORY_DIR : repoMemoryDir(cwd);
	ensureMemoryDir(dir);
	const file = uniqueReflectionPath(dir, label);
	writeFileSync(file, `${reflection.trim()}\n`, "utf-8");
	return file;
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
				const created = [...ensureMemoryDir(GLOBAL_MEMORY_DIR), ...ensureMemoryDir(repoMemoryDir(ctx.cwd))];
				const s = memoryStatus(ctx.cwd);
				const message = [
					created.length > 0 ? `Created:\n${created.map((p) => `- ${p}`).join("\n")}` : "Review memory already initialized.",
					"",
					"Memory locations under ~/.pi, shared across repos without writing into repo working trees:",
					`- Global pool: ${s.globalDir}`,
					`- Current repo bucket: ${s.repoDir}`,
					"",
					nextStepsText(),
				].join("\n");
				notifyOrDisplay(pi, ctx, message);
				return;
			}

			if (subcommand === "prompt") {
				const rawScope = rest.join(" ").trim();
				const scope = rawScope ? (/^\d+$/.test(rawScope) ? `PR ${rawScope}` : rawScope) : "current changes";
				const prompt = reviewPrompt(scope);
				ctx.ui.setEditorText(prompt);
				displayMessage(pi, ctx, "Review prompt placed in editor. Submit it to run the review.");
				return;
			}

			if (/^\d+$/.test(subcommand)) {
				const prompt = reviewPrompt(`PR ${subcommand}`);
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
				const created = [...ensureMemoryDir(GLOBAL_MEMORY_DIR), ...ensureMemoryDir(repoMemoryDir(ctx.cwd))];
				ctx.ui.setEditorText(learningPrompt(ctx.cwd, label));
				displayMessage(pi, ctx, [
					"Learning prompt placed in editor. Submit it to persist durable review-memory entries if warranted.",
					...(created.length > 0 ? ["", `Initialized memory paths:\n${created.map((p) => `- ${p}`).join("\n")}`] : []),
				].join("\n"));
				return;
			}

			notifyOrDisplay(pi, ctx, `Unknown subcommand: ${subcommand}\n\n${usage()}`);
		},
	});

	pi.registerTool({
		name: "review_memory",
		label: "Review Memory",
		description: "Read or explicitly persist Elixir review memory patterns and reflections.",
		promptSnippet: "Read Elixir review memory, or append patterns/write reflections only after explicit persistence approval.",
		promptGuidelines: [
			"Ordinary reviews may use review_memory status/read only.",
			"Use append_pattern or write_reflection only after /elixir-review learn or another explicit user persistence request.",
			"Persist concise, non-sensitive reusable lessons; never overwrite existing memory.",
		],
		parameters: Type.Object({
			action: Type.Union([Type.Literal("status"), Type.Literal("read"), Type.Literal("append_pattern"), Type.Literal("write_reflection")]),
			scope: Type.Optional(Type.Union([Type.Literal("global"), Type.Literal("repo"), Type.Literal("both")])),
			pattern: Type.Optional(Type.String({ description: "Markdown pattern text to append when action is append_pattern." })),
			label: Type.Optional(Type.String({ description: "PR number or label when action is write_reflection." })),
			reflection: Type.Optional(Type.String({ description: "Markdown reflection text when action is write_reflection." })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const readScope = params.scope || "both";
			const readDirs = [
				...(readScope === "global" || readScope === "both" ? [GLOBAL_MEMORY_DIR] : []),
				...(readScope === "repo" || readScope === "both" ? [repoMemoryDir(ctx.cwd)] : []),
			];

			if (params.action === "status") {
				return { content: [{ type: "text", text: statusText(ctx.cwd) }], details: {} };
			}

			if (params.action === "read") {
				const chunks = readDirs.map((dir) => {
					const md = join(dir, "patterns.md");
					const json = join(dir, "patterns.json");
					return [`# ${dir}`, existsSync(md) ? readFileSync(md, "utf-8") : "patterns.md missing", existsSync(json) ? readFileSync(json, "utf-8") : "patterns.json missing"].join("\n\n");
				});
				return { content: [{ type: "text", text: chunks.join("\n\n---\n\n") }], details: {} };
			}

			if (params.action === "write_reflection") {
				if (!params.label?.trim() || !params.reflection?.trim()) {
					return { content: [{ type: "text", text: "write_reflection requires label and reflection text." }], details: { error: "missing_reflection" } };
				}
				const reflectionScope = params.scope === "global" ? "global" : "repo";
				const path = writeReflection(ctx.cwd, params.label.trim(), params.reflection.trim(), reflectionScope);
				return { content: [{ type: "text", text: `Wrote reflection to ${path}` }], details: { path, scope: reflectionScope } };
			}

			if (!params.pattern?.trim()) {
				return { content: [{ type: "text", text: "append_pattern requires pattern text." }], details: { error: "missing_pattern" } };
			}
			const pattern = params.pattern.trim();
			const appendScope = params.scope || "repo";
			const appendDirs = [
				...(appendScope === "global" || appendScope === "both" ? [GLOBAL_MEMORY_DIR] : []),
				...(appendScope === "repo" || appendScope === "both" ? [repoMemoryDir(ctx.cwd)] : []),
			];
			const paths = appendDirs.map((dir) => {
				ensureMemoryDir(dir);
				const path = join(dir, "patterns.md");
				appendFileSync(path, `\n${pattern}\n`, "utf-8");
				return path;
			});
			return { content: [{ type: "text", text: `Appended pattern to ${paths.join(", ")}` }], details: { paths } };
		},
	});
}

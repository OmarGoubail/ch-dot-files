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
		"     Puts a ready review request in the editor. Submit it to make the orchestrator run focused reviewer subagents with the Elixir skills.",
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

First resolve the PR with read-only GitHub CLI commands, including human review context:

\`\`\`bash
gh pr view ${prNumber} --json number,title,body,baseRefName,headRefName,headRepositoryOwner,headRepository,state,url,author,additions,deletions,changedFiles,reviews,comments > /tmp/pi-elixir-review/pr-${prNumber}-meta.json
mkdir -p /tmp/pi-elixir-review
gh pr diff ${prNumber} > /tmp/pi-elixir-review/pr-${prNumber}.patch
gh pr diff ${prNumber} --name-only > /tmp/pi-elixir-review/pr-${prNumber}-files.txt
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/$REPO/pulls/${prNumber}/comments" --paginate > /tmp/pi-elixir-review/pr-${prNumber}-review-comments.json
gh api "repos/$REPO/issues/${prNumber}/comments" --paginate > /tmp/pi-elixir-review/pr-${prNumber}-issue-comments.json
\`\`\`

Before launching reviewers, read human reviews/comments from those JSON files. Human reviewer comments are first-class review context: if a human explicitly asks for tests/changes, surface it in the final review as "Human review context" even if your reviewers classify it as non-blocking. Do not let subagents bury human comments as residual risks.

Then compare PR metadata to the current worktree:

\`\`\`bash
git branch --show-current
git rev-parse --show-toplevel
git status --short
git diff --name-only main...HEAD || true
\`\`\`

If the checked-out branch/head does not match PR ${prNumber}, review the PR diff from \`/tmp/pi-elixir-review/pr-${prNumber}.patch\` and say that local test execution may require checking out the PR branch. Do not silently review \`main...HEAD\` as a substitute for PR ${prNumber}. If you need local execution, ask before checking out or mutating the worktree.`
		: `CURRENT-CHANGES MODE — review the checked-out worktree diff. State the branch and diff range you used, usually \`git diff main...HEAD\` plus uncommitted changes if present.`;

	return `Review ${scope} as an Elixir/Phoenix PR review.

${scopeInstructions}

Use the orchestrator review flow: first run a cheap scout/blast-radius pass, then launch the right number of focused reviewer subagents. Every scout/reviewer task must state the exact source of truth it is inspecting: PR patch path, PR number/base/head, or local diff range.

Preflight scout pass:
- Launch one low-effort scout before reviewers.
- Scout reads the resolved PR patch/file list or local diff plus human PR reviews/comments when present, and reports: changed files, additions/deletions, domains touched (LiveView/HEEx/components, Ecto/schema/migration/query/context, tests, auth/security, jobs/runtime/deploy/config, logging/metadata, prompt/execution paths, defensive normalization, docs-only), human-requested changes, likely Jump signals, suggested skills, recommended fanout/concurrency, and required repo check commands from AGENTS/CLAUDE/mix aliases/CI.
- Scout must not review correctness deeply; it only maps blast radius, discovers local check commands, and proposes review lenses.

Example scout:

subagent({ agent: "scout", task: "Map the blast radius for the resolved PR/local diff source of truth. Read repo instructions such as AGENTS.md/CLAUDE.md and mix.exs aliases. Report changed file categories, size, logging/metadata, prompt/execution, defensive-normalization risk areas, required check commands such as mix jump.ci.lint/credo/targeted tests when present, suggested review skills, and recommended reviewer fanout/concurrency. Do not perform deep review." })

Fanout guidance, using scout output plus additions+deletions, changed files, and risk:
- Tiny/trivial (<150 changed lines, docs/copy/simple tests): usually no subagent or 1 reviewer with elixir-pr-review and elixir-review-memory.
- Small (150-350 lines, low-risk single area): 1-2 reviewers, concurrency 1-2.
- Medium (350-800 lines or 2-3 areas such as LiveView + tests): 3-4 focused reviewers, concurrency 3-4.
- Large/risky (800+ lines, migrations, auth/security, background jobs, deploy/runtime risk, many files, or unclear ownership): 5-6 focused reviewers, concurrency 5-6, plus adversarial when warranted.

Choose lenses by changed files and risk; do not run all reviewers by default. Example for a medium/large Elixir PR:

subagent({ tasks: [
  { agent: "reviewer", task: "Coordinator/baseline review of the resolved PR/local diff source of truth for correctness, regressions, and missing checks using elixir-pr-review and elixir-review-memory. Do not substitute current branch diff for a PR number unless verified.", skill: "elixir-pr-review,elixir-review-memory" },
  { agent: "reviewer", task: "LiveView/HEEx/component review of the same source of truth. Focus on assigns, hooks, components, forms, async, and Jump UI conventions if applicable.", skill: "elixir-liveview-review,jump-elixir-review,elixir-review-memory" },
  { agent: "reviewer", task: "Ecto/data/deploy review of the same source of truth. Focus on schemas, changesets, queries, migrations, transactions, rolling deploys, and runtime safety.", skill: "elixir-ecto-review,elixir-deploy-risk-review,elixir-review-memory" },
  { agent: "reviewer", task: "Security/authorization review of the same source of truth. Focus on tenant/account scoping, LiveView permissions, IDOR, injection, XSS, secrets, structured logging metadata, uploads, and redirects.", skill: "elixir-security-review,jump-elixir-review,elixir-review-memory" },
  { agent: "reviewer", task: "Testing/contracts review of the same source of truth plus human review comments. Focus on PhoenixTest/ExUnit patterns, async safety, assertions, public contracts, specs, routes, documented behavior, logging metadata shape contracts, and any human-requested coverage gaps.", skill: "elixir-testing-review,elixir-code-contracts-review,jump-elixir-review,elixir-review-memory" },
  { agent: "reviewer", task: "Maintainability/contracts/logging review of the same source of truth when scout flags logging metadata builders, prompt/execution paths, or defensive normalization. Focus on strict core contracts, broad fallbacks, structured metadata, pure/cheap/gated payload construction, helper reuse boundaries, and hidden side effects.", skill: "elixir-maintainability-review,elixir-code-contracts-review,elixir-security-review,elixir-review-memory" }
], concurrency: 5 })

Select only relevant skills from: elixir-pr-review, elixir-liveview-review, elixir-ecto-review, elixir-testing-review, elixir-security-review, elixir-deploy-risk-review, elixir-maintainability-review, elixir-code-contracts-review, elixir-git-history-review, elixir-prior-comments-review, elixir-adversarial-review, jump-elixir-review, elixir-review-memory. For PR-number reviews, include elixir-prior-comments-review whenever human comments/reviews exist. Add elixir-maintainability-review and elixir-code-contracts-review when changes touch logging metadata builders, prompt/execution paths, defensive normalization, broad fallbacks, or public specs; add elixir-security-review and/or elixir-adversarial-review when those paths involve side effects, persisted logs, sensitive data, large/risky scope, or deploy-sensitive behavior. Add elixir-git-history-review when history/blame matters.

Checks requirements: before finalizing, reviewers must read repo instructions and discovered check aliases/scripts. Run required repo checks such as mix jump.ci.lint, Credo, format checks, compile, and targeted tests for changed files when available and safe. If a PR is not checked out locally, either run patch-only review and explicitly mark local checks skipped, or ask before creating/checking out a worktree to run the exact PR checks. The final review must list every required check as passed/failed/skipped with reason.

Memory requirements: read global memory at ~/.pi/review-memory/patterns.md and repo-specific memory at ~/.pi/review-memory/repos/<current-repo>/patterns.md if present; apply memory as a verification lens, not as proof. Do not write review memory during ordinary reviews unless the user explicitly requests persistence. In the final review, state whether memory was consulted.

Output all verified findings, split by severity, with exact file:line references. Use path:line or path:start-end for every blocking and non-blocking finding whenever possible; derive line numbers from patch hunks, nl -ba, rg -n, or test output. If no stable line exists, write line unknown and explain why. Include a "Reviewed source" line that says exactly whether you reviewed PR ${prNumber || "<none>"} via gh diff, a checked-out matching branch, or local current changes. Each reviewer must include a "Review lens" section stating assigned lens, what issue classes it looked for, and what was out of scope, so the parent can synthesize coverage without re-reading artifacts. Include a "Review evidence" section listing source inspected, instructions/config read, local patterns checked, facts verified true, and important checks not verified. Include separate sections for "Blocking findings" and "Non-blocking findings"; do not suppress advisory findings, coverage gaps, human-requested changes, or medium/low risks just because they do not block approval. Include a "Human review context" section summarizing unresolved human reviewer comments and whether this review agrees, disagrees, or could not verify. If there are no findings in a section, say "None".`;
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

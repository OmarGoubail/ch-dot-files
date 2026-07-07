/**
 * rm-guard — Smart confirmation for dangerous rm commands
 *
 * Auto-allows rm inside git repos for non-dangerous patterns.
 * Blocks and confirms for everything else.
 *
 * ALWAYS BLOCK (confirm required):
 *   - rm -rf / or rm -rf ~  (catastrophic)
 *   - rm -rf with absolute paths outside cwd
 *   - rm -rf on broad globs (*, **)
 *   - sudo rm anything
 *
 * AUTO-ALLOW (no confirmation):
 *   - rm inside a git repo, targeting files within the repo
 *   - rm of specific files (not directories) without -r flag
 *   - rmdir (only removes empty dirs, safe)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const RM_PATTERN = /\brm\s|rmdir\s/;

// Catastrophic patterns — always block, no exceptions
const CATASTROPHIC = [
	/\brm\s[^|;]*\s+\/\s*$/,          // rm ... /
	/\brm\s[^|;]*\s+\/\s*[;|&]/,      // rm ... / ; ...
	/\brm\s[^|;]*-[^\s]*r[^\s]*\s+\/(?:\s|$)/, // rm -rf /
	/\brm\s[^|;]*-[^\s]*r[^\s]*\s+~/, // rm -rf ~
	/\bsudo\s+rm\b/,                   // sudo rm anything
];

// Dangerous patterns — confirm even inside git repos
const DANGEROUS = [
	/\brm\s[^|;]*-[^\s]*r[^\s]*\s+\.\.\//,   // rm -rf ../  (escaping cwd)
	/\brm\s[^|;]*-[^\s]*r[^\s]*\s+\/[^\s]/,   // rm -rf /absolute/path
	/\brm\s[^|;]*-[^\s]*r[^\s]*\s+\*\*/,       // rm -rf **
	/\brm\s[^|;]*-[^\s]*r[^\s]*\s+\.\s/,       // rm -rf .
	/\brm\s[^|;]*-[^\s]*r[^\s]*\s+\.\//,       // rm -rf ./  (entire cwd)
];

function isInsideGitRepo(cwd: string): boolean {
	try {
		execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

function getGitRoot(cwd: string): string | null {
	try {
		return execSync("git rev-parse --show-toplevel", { cwd, stdio: "pipe" }).toString().trim();
	} catch {
		return null;
	}
}

function targetsStayInRepo(cmd: string, cwd: string, gitRoot: string): boolean {
	// Extract paths after rm [flags] — very rough, catches common cases
	const match = cmd.match(/\brm\s+(?:-[^\s]+\s+)*(.+)/);
	if (!match) return true;

	const args = match[1].trim().split(/\s+/);
	for (const arg of args) {
		if (arg.startsWith("-")) continue; // skip flags
		const resolved = resolve(cwd, arg);
		if (!resolved.startsWith(gitRoot)) return false;
	}
	return true;
}

function hasRecursiveFlag(cmd: string): boolean {
	return /\brm\s[^|;]*-[^\s]*r/.test(cmd);
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const cmd = event.input.command;
		if (!RM_PATTERN.test(cmd)) return;

		// Catastrophic — always block with scary warning
		for (const pattern of CATASTROPHIC) {
			if (pattern.test(cmd)) {
				const ok = await ctx.ui.confirm(
					"🚨 CATASTROPHIC RM",
					`This will cause serious damage:\n\n  ${cmd}\n\nAre you absolutely sure?`,
				);
				if (!ok) return { block: true, reason: "Catastrophic rm blocked by user" };
				return; // user explicitly approved
			}
		}

		// Dangerous — always confirm regardless of git status
		for (const pattern of DANGEROUS) {
			if (pattern.test(cmd)) {
				const ok = await ctx.ui.confirm(
					"⚠️  Dangerous rm",
					`This targets paths outside the working directory:\n\n  ${cmd}`,
				);
				if (!ok) return { block: true, reason: "Dangerous rm blocked by user" };
				return;
			}
		}

		// Inside a git repo? Check if targets stay within it
		const cwd = ctx.cwd;
		if (isInsideGitRepo(cwd)) {
			const gitRoot = getGitRoot(cwd);
			if (gitRoot && targetsStayInRepo(cmd, cwd, gitRoot)) {
				// Safe: inside git repo, targets within repo
				// For rm -rf on broad patterns, still warn
				if (hasRecursiveFlag(cmd) && /\s+\.\s*$|\s+\*\s*$/.test(cmd)) {
					const ok = await ctx.ui.confirm(
						"⚠️  Broad rm -r in repo",
						`Recursive rm with broad target:\n\n  ${cmd}`,
					);
					if (!ok) return { block: true, reason: "Broad rm blocked by user" };
				}
				return; // auto-allow
			}
		}

		// Not in a git repo, or targets escape repo — confirm
		const ok = await ctx.ui.confirm(
			"⚠️  rm outside git repo",
			`No git safety net for this command:\n\n  ${cmd}\n\nAllow?`,
		);
		if (!ok) return { block: true, reason: "rm outside git repo blocked by user" };
	});
}

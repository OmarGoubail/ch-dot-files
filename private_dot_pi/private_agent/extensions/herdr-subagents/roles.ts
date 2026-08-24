import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { AgentRole } from "./types.ts";

const ROLES_DIR = join(dirname(fileURLToPath(import.meta.url)), "agents");

type RoleFrontmatter = {
	name?: unknown;
	description?: unknown;
	tools?: unknown;
	maxTurns?: unknown;
	timeoutMinutes?: unknown;
	writer?: unknown;
};

function toolList(value: unknown): string[] {
	const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
	return [...new Set(values.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function positiveInteger(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function loadRoles(): { roles: AgentRole[]; errors: string[] } {
	const roles: AgentRole[] = [];
	const errors: string[] = [];
	if (!existsSync(ROLES_DIR)) return { roles, errors: [`Missing role directory ${ROLES_DIR}.`] };

	for (const entry of readdirSync(ROLES_DIR, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const filePath = join(ROLES_DIR, entry.name);
		try {
			const { frontmatter, body } = parseFrontmatter<RoleFrontmatter>(readFileSync(filePath, "utf8"));
			if (typeof frontmatter.name !== "string" || typeof frontmatter.description !== "string") {
				errors.push(`${filePath} requires string name and description fields.`);
				continue;
			}
			const tools = toolList(frontmatter.tools);
			if (tools.length === 0) {
				errors.push(`${filePath} requires at least one tool.`);
				continue;
			}
			roles.push({
				name: frontmatter.name.trim(),
				description: frontmatter.description.trim(),
				tools,
				maxTurns: positiveInteger(frontmatter.maxTurns, 15),
				timeoutMinutes: positiveInteger(frontmatter.timeoutMinutes, 25),
				writer: frontmatter.writer === true,
				systemPrompt: body.trim(),
			});
		} catch (error) {
			errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	roles.sort((a, b) => a.name.localeCompare(b.name));
	return { roles, errors };
}

export function loadRole(name: string): AgentRole {
	const result = loadRoles();
	const role = result.roles.find((candidate) => candidate.name === name);
	if (role) return role;
	const detail = result.errors.length ? ` Configuration errors: ${result.errors.join(" | ")}` : "";
	throw new Error(`Unknown agent role '${name}'. Available: ${result.roles.map((item) => item.name).join(", ") || "none"}.${detail}`);
}

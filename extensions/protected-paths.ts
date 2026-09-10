/**
 * Protected Paths Extension
 *
 * Blocks write and edit operations to protected paths.
 * Useful for preventing accidental modifications to sensitive files.
 *
 * Covers write/edit tools directly plus bash redirections (>, >>)
 * targeting protected paths. Configure via PROTECTED_PATHS env
 * (comma-separated, merged with defaults).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEFAULT_PROTECTED = [".env", ".git/", "node_modules/"];

function getProtectedPaths(): string[] {
	const extra = (process.env.PROTECTED_PATHS ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	return [...new Set([...DEFAULT_PROTECTED, ...extra])];
}

function isProtectedPath(path: unknown, protectedPaths: string[]): boolean {
	if (typeof path !== "string" || path.length === 0) return false;
	const normalized = path.replace(/\\/g, "/");
	return protectedPaths.some((p) => {
		if (p.endsWith("/")) return normalized.includes(p) || normalized.includes(`/${p}`);
		const base = normalized.split("/").pop() ?? normalized;
		return base === p || normalized === p || normalized.endsWith(`/${p}`);
	});
}

function bashTargetsProtected(command: unknown, protectedPaths: string[]): string | undefined {
	if (typeof command !== "string") return undefined;
	// Look for redirection targets: > file / >> file (quoted or not)
	for (const m of command.matchAll(/>>?\s*(?:"([^"]+)"|'([^']+)'|([^\s;&|<>]+))/g)) {
		const target = m[1] ?? m[2] ?? m[3];
		if (target && isProtectedPath(target, protectedPaths)) return target;
	}
	return undefined;
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		const protectedPaths = getProtectedPaths();

		if (event.toolName === "write" || event.toolName === "edit") {
			const path = (event.input as { path?: unknown }).path;
			if (typeof path !== "string" || path.length === 0) {
				return { block: true, reason: "Blocked: missing target path." };
			}
			if (isProtectedPath(path, protectedPaths)) {
				if (ctx.hasUI) {
					ctx.ui.notify(`Blocked write to protected path: ${path}`, "warning");
				}
				return { block: true, reason: `Path "${path}" is protected` };
			}
			return undefined;
		}

		if (event.toolName === "bash") {
			const target = bashTargetsProtected((event.input as { command?: unknown }).command, protectedPaths);
			if (target) {
				if (ctx.hasUI) {
					ctx.ui.notify(`Blocked bash redirect to protected path: ${target}`, "warning");
				}
				return { block: true, reason: `Redirect target "${target}" is protected` };
			}
		}

		return undefined;
	});
}

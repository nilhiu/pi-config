/**
 * Permission Gate Extension
 *
 * Prompts for confirmation before running potentially dangerous bash commands.
 * Patterns checked: rm -rf, sudo, chmod/chown 777, destructive fs/git ops.
 *
 * Defers to plan-mode's confirm gate while plan mode is active to avoid
 * double prompts (plan-mode already confirms every bash call there).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const dangerousPatterns = [
		/\brm\s+(-rf?|--recursive)/i,
		/\brmdir\b/i,
		/\bdd\b.*\bof=/i,
		/\bsudo\b/i,
		/\b(chmod|chown)\b.*777/i,
		/\b(chmod|chown)\s+-R/i,
		/\bgit\s+push\b.*--force/i,
	];

	function isPlanModeActive(ctx: { sessionManager: { getEntries(): unknown[] } }): boolean {
		try {
			const entries = ctx.sessionManager.getEntries() as Array<{
				type: string;
				customType?: string;
				data?: { enabled?: unknown };
			}>;
			for (let i = entries.length - 1; i >= 0; i--) {
				const e = entries[i];
				if (e.type === "custom" && e.customType === "plan-mode") {
					return e.data?.enabled === true;
				}
			}
		} catch {
			// If session state is unreadable, fall through to normal gating
		}
		return false;
	}

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = (event.input as { command?: unknown }).command;
		if (typeof command !== "string" || command.trim().length === 0) {
			return { block: true, reason: "Blocked: invalid bash command." };
		}
		const isDangerous = dangerousPatterns.some((p) => p.test(command));
		if (!isDangerous) return undefined;

		// Plan mode already confirm-gates every bash call — don't double-prompt
		if (isPlanModeActive(ctx)) return undefined;

		if (!ctx.hasUI) {
			// In non-interactive mode, block by default
			return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
		}

		const choice = await ctx.ui.select(`⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`, ["Yes", "No"]);

		if (choice !== "Yes") {
			return { block: true, reason: "Blocked by user" };
		}

		return undefined;
	});
}

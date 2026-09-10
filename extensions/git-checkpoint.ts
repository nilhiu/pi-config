/**
 * Git Checkpoint Extension
 *
 * Creates git stash checkpoints at each turn so /fork can restore code state.
 * When forking, offers to restore code to that point in history.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MAX_CHECKPOINTS = 50;

export default function (pi: ExtensionAPI) {
	const checkpoints = new Map<string, string>();
	let currentEntryId: string | undefined;

	function persistCheckpoint(entryId: string, ref: string): void {
		pi.appendEntry("git-checkpoint", { entryId, ref });
	}

	function restoreFromEntries(entries: Array<{ type: string; customType?: string; data?: unknown }>): void {
		checkpoints.clear();
		for (const entry of entries) {
			if (entry.type !== "custom" || entry.customType !== "git-checkpoint") continue;
			const data = entry.data as { entryId?: unknown; ref?: unknown } | undefined;
			if (typeof data?.entryId === "string" && typeof data?.ref === "string") {
				checkpoints.set(data.entryId, data.ref);
			}
		}
		// Cap growth: drop oldest
		while (checkpoints.size > MAX_CHECKPOINTS) {
			const oldest = checkpoints.keys().next().value;
			if (oldest === undefined) break;
			checkpoints.delete(oldest);
		}
	}

	// Track the latest user message as the fork anchor (more reliable than tool_result leaf)
	pi.on("message_end", async (event) => {
		if (event.message.role === "user") {
			const id = (event as { entryId?: unknown }).entryId;
			if (typeof id === "string") currentEntryId = id;
		}
	});

	pi.on("turn_start", async (event, ctx) => {
		// Prefer the explicit turn entry when available, fall back to last user message
		const turnEntryId =
			(event as { entryId?: unknown }).entryId ??
			ctx.sessionManager.getLeafId() ??
			currentEntryId;
		if (typeof turnEntryId === "string") currentEntryId = turnEntryId;

		try {
			const { stdout } = await pi.exec("git", ["stash", "create"]);
			const ref = stdout.trim();
			if (ref && currentEntryId) {
				checkpoints.set(currentEntryId, ref);
				persistCheckpoint(currentEntryId, ref);
				while (checkpoints.size > MAX_CHECKPOINTS) {
					const oldest = checkpoints.keys().next().value;
					if (oldest === undefined) break;
					checkpoints.delete(oldest);
				}
			}
		} catch {
			// Not a git repo or git unavailable — skip silently
		}
	});

	pi.on("session_before_fork", async (event, ctx) => {
		const ref = checkpoints.get(event.entryId);
		if (!ref) return;

		if (!ctx.hasUI) {
			// In non-interactive mode, don't restore automatically
			return;
		}

		try {
			const { stdout } = await pi.exec("git", ["status", "--porcelain"]);
			if (stdout.trim().length > 0) {
				const choice = await ctx.ui.select(
					"Working tree is dirty. Restore code state? (uncommitted changes may conflict)",
					["No, keep current code", "Yes, restore code to that point"],
				);
				if (!choice?.startsWith("Yes")) return;
			} else {
				const choice = await ctx.ui.select("Restore code state?", [
					"Yes, restore code to that point",
					"No, keep current code",
				]);
				if (!choice?.startsWith("Yes")) return;
			}
			await pi.exec("git", ["stash", "apply", ref]);
			ctx.ui.notify("Code restored to checkpoint", "info");
		} catch (err) {
			ctx.ui.notify(`Checkpoint restore failed: ${err instanceof Error ? err.message : String(err)}`, "error");
		}
	});

	pi.on("session_start", async (_event, ctx) => {
		restoreFromEntries(ctx.sessionManager.getEntries() as Array<{ type: string; customType?: string; data?: unknown }>);
		const leafId = ctx.sessionManager.getLeafId();
		if (leafId) currentEntryId = leafId;
	});

	pi.on("session_tree", async (_event, ctx) => {
		restoreFromEntries(ctx.sessionManager.getBranch() as Array<{ type: string; customType?: string; data?: unknown }>);
	});
}

/**
 * Plan Mode Extension (reworked: Phases 0+1)
 *
 * Read-only exploration mode with tool-based plan submission.
 * - /plan toggles planning mode (edit/write disabled, bash confirm-gated)
 * - LLM submits plan via plan_submit tool -> status "ready"
 * - User approves via /plan-approve (hands off to todo extension, hides widget)
 * - /plan-cancel escapes anywhere. /plan-todos shows current plan.
 *
 * Decisions applied: bash confirm-gate, separate from todo ext (B),
 * clean break from [DONE:n]/Plan: parsing, widget hidden during execution.
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { PlanStep } from "./utils.ts";

const PLAN_SUBMIT_TOOL = "plan_submit";
const DISABLED_IN_PLAN_MODE = new Set<string>(["edit", "write"]);

type PlanStatus = "planning" | "ready";

interface PlanModeState {
	enabled: boolean;
	status?: PlanStatus;
	title?: string;
	steps?: PlanStep[];
	toolsBeforePlanMode?: string[];
}

const PlanSubmitParams = Type.Object({
	title: Type.String({ description: "Short plan title" }),
	steps: Type.Array(Type.String(), { description: "Plan steps in order" }),
});

export default function planModeExtension(pi: ExtensionAPI): void {
	let planModeEnabled = false;
	let planStatus: PlanStatus = "planning";
	let planTitle = "";
	let planSteps: PlanStep[] = [];
	let toolsBeforePlanMode: string[] | undefined;

	pi.registerFlag("plan", {
		description: "Start in plan mode (read-only exploration)",
		type: "boolean",
		default: false,
	});

	function updateStatus(ctx: ExtensionContext): void {
		if (!planModeEnabled) {
			ctx.ui.setStatus("plan-mode", undefined);
			ctx.ui.setWidget("plan-todos", undefined);
			return;
		}
		if (planStatus === "ready" && planSteps.length > 0) {
			ctx.ui.setStatus(
				"plan-mode",
				ctx.ui.theme.fg("accent", `📋 ready ${planSteps.length} steps`),
			);
			const lines = [
				ctx.ui.theme.fg("accent", planTitle || "Plan ready"),
				...planSteps.map((s) => `${ctx.ui.theme.fg("muted", "☐ ")}${s.text}`),
				ctx.ui.theme.fg("dim", "/plan-approve to execute · /plan-cancel to discard"),
			];
			ctx.ui.setWidget("plan-todos", lines);
		} else {
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", "⏸ plan"));
			if (planSteps.length > 0) {
				const lines = planSteps.map((s) => `${ctx.ui.theme.fg("muted", "☐ ")}${s.text}`);
				ctx.ui.setWidget("plan-todos", lines);
			} else {
				ctx.ui.setWidget("plan-todos", undefined);
			}
		}
	}

	function enablePlanModeTools(): void {
		if (toolsBeforePlanMode === undefined) {
			toolsBeforePlanMode = pi.getActiveTools();
		}
		const next = [...new Set([...toolsBeforePlanMode.filter((n) => !DISABLED_IN_PLAN_MODE.has(n)), PLAN_SUBMIT_TOOL])];
		pi.setActiveTools(next);
	}

	function restoreNormalModeTools(): void {
		if (toolsBeforePlanMode !== undefined) {
			pi.setActiveTools(toolsBeforePlanMode.filter((n) => n !== PLAN_SUBMIT_TOOL));
			toolsBeforePlanMode = undefined;
		}
		// If no snapshot, leave tools untouched (don't clobber user intent).
	}

	function persistState(): void {
		pi.appendEntry("plan-mode", {
			enabled: planModeEnabled,
			status: planStatus,
			title: planTitle,
			steps: planSteps,
			toolsBeforePlanMode,
		} satisfies PlanModeState);
	}

	function clearPlan(): void {
		planTitle = "";
		planSteps = [];
		planStatus = "planning";
	}

	function togglePlanMode(ctx: ExtensionContext): void {
		planModeEnabled = !planModeEnabled;
		clearPlan();

		if (planModeEnabled) {
			enablePlanModeTools();
			ctx.ui.notify("Plan mode enabled. Edit/write disabled, bash needs confirmation.");
		} else {
			restoreNormalModeTools();
			ctx.ui.notify("Plan mode disabled. Full access restored.");
		}
		updateStatus(ctx);
		persistState();
	}

	// --- plan_submit tool (only active during planning) ---
	pi.registerTool({
		name: PLAN_SUBMIT_TOOL,
		label: "Plan Submit",
		description:
			"Submit the exploration plan for user review. Call once with the full ordered step list. Only available in plan mode.",
		parameters: PlanSubmitParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!planModeEnabled) {
				return {
					content: [{ type: "text", text: "Error: not in plan mode" }],
					details: { error: "not in plan mode" },
				};
			}
			const cleaned = (params.steps ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
			if (!params.title?.trim() || cleaned.length === 0) {
				return {
					content: [{ type: "text", text: "Error: title and at least one step required" }],
					details: { error: "title/steps required" },
				};
			}
			planTitle = params.title.trim();
			planSteps = cleaned.map((text, i) => ({ id: i + 1, text }));
			planStatus = "ready";
			if (ctx) updateStatus(ctx as ExtensionContext);
			persistState();
			return {
				content: [
					{
						type: "text",
						text: `Plan submitted (${cleaned.length} steps). Waiting for user approval (/plan-approve).`,
					},
				],
				details: { title: planTitle, steps: planSteps },
			};
		},
	});

	pi.registerCommand("plan", {
		description: "Toggle plan mode (read-only exploration)",
		handler: async (_args, ctx) => togglePlanMode(ctx),
	});

	pi.registerCommand("plan-todos", {
		description: "Show current plan steps",
		handler: async (_args, ctx) => {
			if (!planModeEnabled || planSteps.length === 0) {
				ctx.ui.notify("No plan. Enable /plan and ask the agent to submit one.", "info");
				return;
			}
			const list = planSteps.map((s) => `${s.id}. ☐ ${s.text}`).join("\n");
			ctx.ui.notify(`${planStatus === "ready" ? "Plan (ready)" : "Plan (draft)"}${planTitle ? `: ${planTitle}` : ""}\n${list}`, "info");
		},
	});

	pi.registerCommand("plan-approve", {
		description: "Approve the plan and hand off execution (hides plan widget)",
		handler: async (_args, ctx) => {
			if (!planModeEnabled) {
				ctx.ui.notify("Not in plan mode.", "error");
				return;
			}
			if (planStatus !== "ready" || planSteps.length === 0) {
				ctx.ui.notify("No submitted plan to approve yet.", "error");
				return;
			}
			const stepsText = planSteps.map((s) => `${s.id}. ${s.text}`).join("\n");
			const title = planTitle;
			clearPlan();
			planModeEnabled = false;
			restoreNormalModeTools();
			updateStatus(ctx);
			persistState();

			pi.sendMessage(
				{
					customType: "plan-mode-execute",
					content: `Approved plan: ${title}\n${stepsText}\n\nCreate matching todos with the todo tool, then work through them.`,
					display: true,
				},
				{ triggerTurn: true, deliverAs: "followUp" },
			);
		},
	});

	pi.registerCommand("plan-cancel", {
		description: "Discard the current plan and leave plan mode",
		handler: async (_args, ctx) => {
			if (!planModeEnabled) {
				ctx.ui.notify("Not in plan mode.", "info");
				return;
			}
			clearPlan();
			planModeEnabled = false;
			restoreNormalModeTools();
			updateStatus(ctx);
			persistState();
			ctx.ui.notify("Plan discarded.", "info");
		},
	});

	pi.registerShortcut(Key.ctrlAlt("p"), {
		description: "Toggle plan mode",
		handler: async (ctx) => togglePlanMode(ctx),
	});

	// Bash confirm-gate in plan mode (replaces allowlist)
	pi.on("tool_call", async (event, ctx) => {
		if (!planModeEnabled || event.toolName !== "bash") return;
		const command = (event.input as { command?: unknown }).command;
		if (typeof command !== "string" || command.trim().length === 0) {
			return { block: true, reason: "Plan mode: invalid bash command." };
		}
		if (!ctx.hasUI) {
			return { block: true, reason: "Plan mode: bash needs confirmation (no UI available)." };
		}
		const choice = await ctx.ui.select(`Plan mode (read-only) — allow bash?\n\n  ${command}`, ["Yes", "No"]);
		if (choice !== "Yes") {
			return { block: true, reason: "Blocked by user (plan mode)." };
		}
	});

	// Filter out stale plan-mode context when not in plan mode
	pi.on("context", async (event) => {
		if (planModeEnabled) return;
		return {
			messages: event.messages.filter((m) => {
				const msg = m as AgentMessage & { customType?: string };
				if (msg.customType === "plan-mode-context" || msg.customType === "plan-execution-context") return false;
				if (msg.role !== "user") return true;
				const content = msg.content;
				if (typeof content === "string") {
					return !content.includes("[PLAN MODE ACTIVE]");
				}
				if (Array.isArray(content)) {
					return !content.some(
						(c) => c.type === "text" && (c as TextContent).text?.includes("[PLAN MODE ACTIVE]"),
					);
				}
				return true;
			}),
		};
	});

	// Inject planning instructions (no execution context — todo ext owns execution)
	pi.on("before_agent_start", async () => {
		if (!planModeEnabled) return;
		if (planStatus === "ready") {
			return {
				message: {
					customType: "plan-mode-context",
					content: `[PLAN MODE: plan submitted, awaiting user approval]\nDo not execute changes. If the user wants revisions, call plan_submit again with the updated plan.`,
					display: false,
				},
			};
		}
		return {
			message: {
				customType: "plan-mode-context",
				content: `[PLAN MODE ACTIVE]
You are in plan mode - a read-only exploration mode.

Restrictions:
- Built-in edit and write tools are disabled
- Bash commands need user confirmation
- Do NOT make changes - explore and plan only

When ready, call the plan_submit tool once with a title and the full ordered step list.
Do not output [DONE:n] tags or rely on Plan: headers - plan_submit is the only submission path.`,
				display: false,
			},
		};
	});

	function restoreFromEntries(entries: Array<{ type: string; customType?: string; data?: unknown }>): void {
		const entry = entries
			.filter((e) => e.type === "custom" && e.customType === "plan-mode")
			.pop() as { data?: PlanModeState } | undefined;
		const data = entry?.data;
		if (!data) return;
		// Clean break: ignore legacy executing/todos/completed fields; only new shape restores.
		if (typeof data.enabled === "boolean") planModeEnabled = data.enabled;
		if (data.status === "ready" || data.status === "planning") planStatus = data.status;
		if (typeof data.title === "string") planTitle = data.title;
		if (Array.isArray(data.steps)) {
			planSteps = (data.steps as PlanStep[]).filter(
				(s) => typeof s?.id === "number" && typeof s?.text === "string",
			);
		}
		if (Array.isArray(data.toolsBeforePlanMode)) toolsBeforePlanMode = [...data.toolsBeforePlanMode];
	}

	// Restore state on session start/resume/tree
	pi.on("session_start", async (_event, ctx) => {
		if (pi.getFlag("plan") === true) {
			planModeEnabled = true;
			planStatus = "planning";
		}
		restoreFromEntries(ctx.sessionManager.getEntries() as Array<{ type: string; customType?: string; data?: unknown }>);
		// Never restore into a phantom "executing" state: widget hides on handoff.
		if (planModeEnabled) {
			enablePlanModeTools();
		}
		updateStatus(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		// Rebuild from branch tip so /fork shows the right plan.
		planModeEnabled = false;
		clearPlan();
		toolsBeforePlanMode = undefined;
		restoreFromEntries(ctx.sessionManager.getBranch() as Array<{ type: string; customType?: string; data?: unknown }>);
		if (planModeEnabled) {
			enablePlanModeTools();
		}
		updateStatus(ctx);
	});
}

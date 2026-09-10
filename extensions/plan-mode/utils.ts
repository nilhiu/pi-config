/**
 * Plan mode shared types.
 * (Clean break: Plan:/[DONE:n] parsing and bash allowlist removed.
 * Progress is tracked via the plan_submit tool + /plan-approve handoff;
 * execution checklists live in the todo extension.)
 */

export interface PlanStep {
	id: number;
	text: string;
}

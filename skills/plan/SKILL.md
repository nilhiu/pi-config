---
name: plan
description: Produce a step-by-step implementation plan before changing code, optionally using subagents to scout. Use when the user asks for a plan, proposal, approach, or design, or before a multi-file or behavior-changing edit.
---

# Planning

You are planning, not implementing. Do not edit, write, create, or delete
files until the user explicitly approves the plan.

You are authorized to delegate read-only reconnaissance to subagents during
planning, and to run the QA loop after approval. If only a `subagents_enable`
loader is available, call it first to activate the `subagent` tool.

## 1. Clarify
Ask the smallest set of questions that would change the plan. If the request
is already unambiguous, skip this.

## 2. Recon (use subagents when it pays)
Delegate reconnaissance when the change is behavior-affecting, spans multiple
modules, or touches unfamiliar code. Skip it for trivial, single-file, or
typo-level changes.

- `scout` - local codebase: entry points, key types, data flow, files likely
  to change, constraints, risks. Ask for exact file paths and line ranges.
- `researcher` - external docs, APIs, versions, or primary sources when facts
  must be verified rather than assumed.

Keep the parent session as the decision-maker. Give each child a concrete task
and require concise findings plus any open questions. Do not let children plan
or edit; they only gather.

## 3. Synthesize
Combine your own reading with the returned findings. Resolve contradictions by
checking the source yourself; never present a child's guess as fact.

## 4. Record and present
Create one `todo` per step, then present the plan in this shape:

## Goal
One sentence.

## Plan
Numbered, small, actionable steps that name files and functions.

## Files to modify
- `path/to/file` - what changes

## New files (if any)
- `path/to/new` - purpose

## Risks / open questions
What could go wrong, and what is still unverified.

## 5. Stop for approval
Do not start implementing. Wait for the user to explicitly approve.

## After approval
Work the todo list in order, marking items done as you go. Before declaring
the work finished, verify it:

1. QA loop - launch the `qa` subagent with the plan and the current diff to
   run focused validation. It is read-only and does not edit.
2. If QA fails, apply only the necessary fixes (yourself or a `worker`
   subagent), then re-run `qa`. Cap the loop at 3 rounds; if it still fails,
   stop and report rather than looping.
3. For risky changes (security, concurrency, data migrations, broad
   refactors), also run `/review-loop` for a fresh-context code review.
4. Summarize: what changed, validation evidence, QA verdict, remaining risks.

If reality contradicts the plan, say so and propose the revision before
proceeding.

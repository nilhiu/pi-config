# Plan Mode Extension (reworked)

Read-only exploration mode with tool-based plan submission.

## Commands

- `/plan` - Toggle plan mode
- `/plan-todos` - Show current plan steps
- `/plan-approve` - Approve plan, hand off to `todo` ext (hides widget)
- `/plan-cancel` - Discard plan, leave plan mode
- `Ctrl+Alt+P` - Toggle plan mode

## Usage

1. `/plan`, ask the agent to explore
2. Agent calls `plan_submit({title, steps})` → status `ready`
3. `/plan-approve` → full tools back, widget hidden, agent told to mirror steps into `todo` tool and execute
4. Track execution with `/todos` (todo extension owns it)

## Design notes (bigger rework decisions)

- Bash in plan mode: kept, but every call needs confirmation (no allowlist).
- Separate from `todo` ext: plan widget only shows in planning/ready, hidden after approve.
- Clean break: no `Plan:` parsing, no `[DONE:n]` tags. Old sessions' plan entries are ignored.
- Tool snapshot is restored exactly (no forced tool injection).

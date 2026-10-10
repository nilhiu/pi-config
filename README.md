# pi-config

My [pi](https://pi.dev) coding agent configuration. Public, same as any
dotfiles repo - secrets (`auth.json`) and history (`sessions/`) are
git-ignored and never committed.

## Contents

- `settings.json` - theme, default model, package list
- `pi-vcc-config.json` - pi-vcc compaction settings
  (`overrideDefaultCompaction: true`, so pi-vcc owns `/compact` and
  auto/overflow compaction instead of Pi's LLM summarizer)
- `mcp.json` - MCP servers (Context7 docs, remote and anonymous)
- `extensions/` - local workflow extensions (mostly pi's stock examples):
  git checkpoints, todos, tool toggles, desktop notify, presets
- `skills/` - model-invoked skills (`plan`: plan-first workflow with optional
  `scout` recon and a post-approval QA loop; `docs`: version-pinned
  documentation lookup via Context7 and web search)
- `agents/` - custom subagent definitions for `pi-subagents`
  (`planner.md`, `qa.md`; scout/worker/reviewer come from pi-subagents builtins)

## Packages

Declared in `settings.json` -> `packages`:

- [`sanae-mascot-pi`](https://github.com/nilhiu/sanae-mascot-pi) - the mascot
- [`@aliou/pi-guardrails`](https://github.com/aliou/pi-guardrails) - file
  protection, path access, and dangerous-bash permission gate
- [`@sting8k/pi-vcc`](https://github.com/sting8k/pi-vcc) - deterministic,
  no-LLM conversation compaction
- [`pi-subagents`](https://github.com/nicobailon/pi-subagents) - focused
  child agents, orchestration, background runs, saved workflows
- [`pi-web-access`](https://github.com/nicobailon/pi-web-access) - web search,
  URL/PDF fetching, and video understanding (also unlocks the `researcher`
  subagent)

## Fresh machine setup

```bash
git clone <this-repo> ~/.pi/agent
pi # log in to providers; packages install/resolve
```

Guardrails keeps interactive policy in `extensions/guardrails.json`
(machine-local); run `/guardrails:onboarding` after installing.

# pi-config

My [pi](https://pi.dev) coding agent configuration. Public, same as any
dotfiles repo - secrets (`auth.json`) and history (`sessions/`) are
git-ignored and never committed.

## Contents

- `settings.json` - theme, default model, package list
- `extensions/` - workflow extensions (mostly pi's stock examples):
  permission gate, protected paths, git checkpoints, todos, tool toggles,
  desktop notify, plan-mode, presets
- Mascot lives in its own package:
  [`sanae-mascot-pi`](https://github.com/nilhiu/sanae-mascot-pi)
  (already referenced in `settings.json` -> `packages`)

## Fresh machine setup

```bash
git clone <this-repo> ~/.pi/agent
pi # log in to providers; packages resolve
pi install git:github.com/nilhiu/sanae-mascot-pi # if the mascot is missing
```

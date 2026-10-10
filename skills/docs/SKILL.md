---
name: docs
description: Fetch current, version-specific documentation for a library, framework, SDK, API, or CLI before using it. Use when the task depends on how a library works, its API syntax, configuration, or version migration, and when the user asks for docs or "latest" behavior.
---

# Documentation lookup

Do not answer version-specific API questions from memory. Fetch the docs, and
cite the source and version you used.

## 1. Pin the version first
Find the version actually installed or pinned before fetching anything:
- read the manifest and lockfile (`package.json` + lockfile, `Cargo.toml` +
  `Cargo.lock`, `go.mod`, `pyproject.toml` + lockfile, and so on)
- fall back to "latest" only when the project has no pin or the user explicitly
  asks about latest.

## 2. Library and API docs (Context7 MCP)
Use the Context7 tools:
- `resolve-library-id` - match the exact library name, passing the pinned
  version when available.
- `query-docs` - ask a specific, narrow question (API syntax, a single function
  or option, configuration, version migration). Prefer several focused queries
  over one broad one.

## 3. Everything else (web)
For release notes, changelogs, blog posts, RFCs, or libraries Context7 does not
index, use pi-web-access:
- `web_search` to find the source, then `fetch_content` to read it.
Prefer official documentation over third-party summaries, and confirm the page
matches the pinned major version.

## 4. Report
- Cite the library, version, and source (URL or Context7 library id).
- Quote only what answers the question; summarize the rest.
- If the docs contradict the version in use, say so and point to the migration
  notes or the correct version's docs rather than guessing.

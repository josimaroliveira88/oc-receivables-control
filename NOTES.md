# Pending changelog notes

This file holds short notes about completed adjustments that have **not yet** been promoted to a dated section in `CHANGELOG.md`.

It exists so the agent can stop and check with the user after each adjustment without leaving work dangling in `CHANGELOG.md` (the project no longer keeps a running `## [Unreleased]` section). See the **New Feature Workflow** in `AGENTS.md` for the full protocol.

## When to add an entry

After finishing an adjustment, the agent asks the user:

> Você tem mais algum ajuste a adicionar nesta versão?

If the user answers **yes**, the agent appends a new note block below describing the adjustment that was just verified. The agent then ends the turn without touching `CHANGELOG.md`.

If the user answers **no**, the agent consolidates every block in this file plus the just-completed work into a new dated `## Phase N` section at the top of `CHANGELOG.md`, grouped under `Added`, `Changed`, `Fixed`, `Tests`, etc. The agent then deletes the consolidated entries from this file.

## Entry format

Each entry follows the structure below. Keep the wording consistent with the rest of `CHANGELOG.md` (English for internals, PT-BR for user-facing behavior).

```text
## YYYY-MM-DD — short title

- Short summary of what changed and why.
- Files touched (e.g. `frontend/src/pages/ProductsPage.jsx`, `backend/...`).
- Tests added/updated and the verification result (e.g. 168 backend + 321 frontend passing, `npm run build` clean, `npm run format:check` clean).
```



# Pending changelog notes

This file holds short notes about completed adjustments that have **not yet** been promoted to a dated section in `CHANGELOG.md`.

**This file stays tracked by git but is never committed.** Update it freely following the template below, but never stage or include it in a commit — even when it has pending changes. Its entries are consolidated into `CHANGELOG.md` and then deleted from here (see the **New Feature Workflow** in `AGENTS.md`).

It exists so the agent can stop and check with the user after each adjustment without leaving work dangling in `CHANGELOG.md` (the project no longer keeps a running `## [Unreleased]` section). See the **New Feature Workflow** in `AGENTS.md` for the full protocol.

## When to add an entry

After finishing an adjustment, the agent asks the user:

> Como deseja encerrar este ajuste?

and offers every applicable option:

- **Sem mais ajustes — consolidar e commitar**: consolidate every block here plus the just-completed work into a new dated `## Phase N` section at the top of `CHANGELOG.md`, then delete the consolidated entries from this file and create the commits.
- **Sem mais ajustes — apenas consolidar**: same consolidation and cleanup, but do **not** commit.
- **Com mais ajustes — registrar no `NOTES.md` e commitar**: append a new note block below describing the adjustment that was just verified, do **not** touch `CHANGELOG.md`, and commit the code change (never this file).
- **Com mais ajustes — apenas registrar no `NOTES.md`**: append the note block, do **not** touch `CHANGELOG.md`, and do not commit.
- **Há uma correção ou pedido novo**: when a correction or new request was identified, ask the user to describe it and write **nothing** here or in `CHANGELOG.md`; handle the request before any consolidation.

## Entry format

Each entry follows the structure below. Keep the wording consistent with the rest of `CHANGELOG.md` (English for internals, PT-BR for user-facing behavior).

```text
## YYYY-MM-DD — short title

- Short summary of what changed and why.
- Files touched (e.g. `frontend/src/pages/ProductsPage.jsx`, `backend/...`).
- Tests added/updated and the verification result (e.g. 168 backend + 321 frontend passing, `npm run build` clean, `npm run format:check` clean).
```

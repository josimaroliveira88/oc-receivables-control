---
name: implementation-style
description: Coding and response conventions.
---

# Implementation Style

When generating code:

- Produce complete files.
- Never generate TODO placeholders.
- Never omit code sections.
- Produce production-ready implementations.

## Scope Control

- Implement only the requested phase.
- Do not anticipate future phases.
- Respect incremental delivery.
- Apply SOLID pragmatically (see `AGENTS.md` — Design Principles): refactor toward a principle only when it adds clarity/testability and is scoped to the change being made — never refactor wholesale just to "be SOLID".

## Response Format

For implementation tasks:

1. File Path
2. Code Block
3. Explanation
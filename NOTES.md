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

## 2026-08-21 — Move order-form validation error inside the edit/create modal

- Follow-up to Phase 53: the order edit/create modal also surfaced form-level errors (`"Número do pedido é obrigatório"`, `"Preencha todos os campos dos itens corretamente"`, and the `"Erro ao criar/atualizar/excluir pedido"` submit failures) in the page-level banner rendered above the orders table, which sat **behind** the modal's full-screen `z-[60]` backdrop with `bg-black/40 backdrop-blur-sm` — so the message appeared dimmed/blurred and partially hidden. The error is now rendered inside the `OrderForm` (above the "Itens do Pedido" heading, exactly where the user expected it), and the page-level banner is suppressed while the modal is open so it remains reachable only for true page-level errors (load failures).
- Files touched: `frontend/src/pages/Orders/components/OrderForm.jsx` (new `error` prop + `data-testid="order-form-error"` banner above the items section), `frontend/src/pages/Orders/index.jsx` (passes `error` to `OrderForm`; page banner gated on `!(showCreateModal || showEditModal)`).
- Tests added: `frontend/tests/OrdersPage.test.jsx` — "should render the form validation error inside the modal (not behind it)" asserts the validation error appears inside the `fixed inset-0 z-[60]` modal dialog when the form is submitted with an item missing a person.
- Verification: frontend `371 passed` (370 + 1 new), `npm run build` clean, `npm run format:check` clean. Visually verified with Playwright against the running app on order `12333554` (self-person item, then unlinked on submit): error banner is inside the modal (`errInsideModal: true`) and `elementFromPoint` at the error's center hits the error's own text element (`errIsTopMost: true`), while the modal keeps its `backdrop-filter: blur(4px)`.

## 2026-08-21 — Apply the same modal-error fix to People and Products

- The same inconsistency existed in the **People** and **Products** pages: their form-level validation and submit errors (`"Nome é obrigatório"`, `"Código é obrigatório"`, `"Tamanho é obrigatório"`, `"URL do produto inválida"`, `"Erro ao criar/atualizar ..."`) are stored in a page-level `error` state and were rendered in the page banner above the table — behind the `PersonModal`/`ProductModal` (`z-[60]`, `bg-black/40 backdrop-blur-sm`). The error is now rendered at the top of each modal form, and the page-level banner is suppressed while a modal is open (it remains only for page-level load failures). The **Stock** page was audited and is not affected: its dialogs already render their own inline errors and its page-level `error` only fires on inventory-load failure.
- Files touched: `frontend/src/pages/People/components/PersonForm.jsx` + `frontend/src/pages/People/index.jsx`, `frontend/src/pages/Products/components/ProductForm.jsx` + `frontend/src/pages/Products/index.jsx` (new `error` prop + `data-testid="person-form-error"`/`"product-form-error"` banner at the top of the form; page banner gated on `!(showCreateModal || showEditModal)`).
- Tests added: `frontend/tests/PeoplePage.test.jsx` and `frontend/tests/ProductsPage.test.jsx` — "should render the form validation error inside the modal (not behind it)" asserts the validation error appears inside the `fixed inset-0 z-[60]` modal dialog.
- Verification: frontend `373 passed` (371 + 2 new), `npm run build` clean, `npm run format:check` clean.


# Frontend Architecture Guide

This is the single reference for how the React frontend is organized and how any change — new feature, improvement, or maintenance — should keep it organized.

## 1. Principles

- **One responsibility per file.** A file owns one concern; cohesion over size.
- **Stateful logic separate from markup.** Hooks hold state and I/O; components render props.
- **Pure where possible.** If a function uses no React hook, it belongs in `utils/`, not in a component.
- **Testability.** Business rules and pure helpers must be unit-testable without rendering React.

## 2. Progressive complexity policy

Not every file needs a folder. Apply the smallest structure that keeps the file cohesive.

### Level 1 — Single file

Use for: small pages, focused components, single-concept helpers.

A file may stay single when it:
- does not mix API calls, complex state, and dense JSX;
- has no internal subcomponent worth extracting;
- is easy to read, test, and locate logic in.

Examples: `LoginPage.jsx`, `RegisterPage.jsx`, `ActionMenu.jsx`.

### Level 2 — Point extraction

Apply when a few signals of complexity appear (reusable subcomponent, relevant formatter/validation, long form/table, repeated logic, hard to test).

Extract only what is needed — no full folder required:

```text
SomeComponent.jsx
SomeComponentHelpers.js
SomeForm.jsx
```

### Level 3 — Page orchestrator

Apply to a page that mixes React state, API calls, handlers, and dense JSX, or that has table/form/modal/complex flow, or that crosses ~400 lines (whichever comes first). `DashboardPage` (295 lines) qualified because it mixed fetch, export, KPIs, chart, and yearly table in one file — line count is a trigger, not the only signal.

```text
pages/{Nome}Page.jsx              # Shim: One line re-exporting the folder.
pages/{Nome}/
├── index.jsx                     # Orchestrator (~60-150 lines)
├── use{Nome}.js                  # State + API + mutation handlers
├── components/                   # Local subcomponents
└── utils/
    └── {nome}Helpers.js          # Pure helpers
```

The single `*Page.jsx` file stays as a one-line shim (`export { default } from './{Nome}/index.jsx';`) so existing imports (routes, tests) keep working without edits.

The ~400-line threshold is a mandatory review trigger, not an absolute rule: files below it can be Level 3 if they mix responsibilities; files above it cannot stay at Level 1.

## 3. Conventions by file type

| Type | Rule |
|---|---|
| Page | Orchestrator only when complex (Level 3); otherwise a single file. `index.jsx` must not call `api.*` directly. |
| Component | Focused on one concern; receives data and callbacks via props. Split when it has multiple visual regions or repeated JSX. |
| Hook (`use{Nome}.js`) | Owns state and I/O for one domain. No generic hooks like `useApi`. |
| Utils (`{nome}Helpers.js`) | Pure functions for one domain. Split by domain when unrelated concepts accumulate. |
| Shared component | Lives in `src/components/` only if genuinely reusable (`ActionMenu`, `Modal`, `ConfirmDialog`, `Toast`); page-only widgets stay in the page folder. `Modal` is the single wrapper for every dialog (see `AGENTS.md` High-Value Pitfalls): it owns the `z-[60]` backdrop, backdrop click + Escape, and the polite close (`isDirty` → discard `ConfirmDialog`). Form modals pass children as a render prop `(requestClose) => ...` and compute `isDirty` with the shared `src/hooks/useDirtyForm.js` against a snapshot the domain hook owns. |

## 4. Rules for any request

Apply to every new feature, improvement, or maintenance task:

1. **Assess before editing.** Check the complexity level of every affected file.
2. **Don't push a file past its limit.** Don't add a new responsibility to a file already at its threshold.
3. **Extract in the same change.** If your edit would make a file complex, extract the responsibility in the same request — don't defer it.
4. **Preserve an adequate structure.** If the existing structure is correct, follow it; don't refactor mechanically.
5. **Don't over-split simple files.** Forcing a folder onto a trivial file adds friction, not clarity.
6. **Verify after structural changes.** Run `npm run test`, `npm run build`, and `npm run format:check`.

## 5. Page refactoring playbook

When a page is promoted to Level 3, apply these steps in order.

### Step 1 — Isolate pure functions

- Create `utils/{nome}Helpers.js` inside the page folder.
- Move there: parsers, formatters, simple validations, status maps, select options, and calculations that use no React hooks.
- Rule: if a function uses no `useState`/`useEffect`/hook, it can be pure.

### Step 2 — Isolate small visual components

- Create `components/Badges.jsx`, `StatusIcon.jsx`, etc.
- They must: receive only props; hold no own state (except micro-interactions like hover); be unit-testable.

### Step 3 — Isolate complex UI subcomponents

| Page pattern | Extracted component | Responsibility |
|---|---|---|
| Responsive table (desktop + mobile cards) | `components/{Nome}Table.jsx` | List, row actions, badges, totals |
| Flowbite/Bootstrap modal | `components/{Nome}Modal.jsx` | Fixed backdrop, scrollable container, header with title and close button |
| Long form | `components/{Nome}Form.jsx` | Inputs, visual validation, submit buttons |
| Repeated form fields (e.g. order items) | `components/{Nome}ItemFields.jsx` | Individual card with its own inputs and events |
| Autocomplete / Combobox | `components/{Nome}Combobox.jsx` | Internal search state (`query`, `open`), filter, selection |

**Exclusivity rule:** a component that only makes sense in the page lives in `pages/{Nome}/components/`. A generic one (`ActionMenu`, `ConfirmDialog`) stays in `src/components/`.

### Step 4 — Extract the custom hook

- Create `use{Nome}.js` next to `index.jsx`.
- The hook owns: all state (`useState`, `useRef`); all API calls (`api.get`, `api.post`, …); all mutation handlers (create, update, delete); simple derived computations (totals, filters) — or delegate those to pure child components.
- Return a destructurable object of state + handlers.
- Avoid generic hooks (e.g. `useApi`); one hook per page keeps business logic localized and testable.

### Step 5 — Rewrite the page as orchestrator

`index.jsx` has only: the hook call; the loading conditional (spinner); the composition of extracted components. Size goal: 60–150 lines.

### Step 6 — Keep imports compatible

Replace `pages/{Nome}Page.jsx` with the shim so `App.jsx`, tests, and any existing imports need no edits.

### Step 7 — Post-refactoring checks

- [ ] `npm run test` (frontend) — existing tests pass unchanged.
- [ ] `npm run build` (frontend) — build does not break.
- [ ] `npm run format:check` (root) — Prettier ok.
- [ ] No `data-testid` removed or changed — UI tests depend on them.
- [ ] All visible texts (labels, placeholders, buttons, error messages) stay identical.
- [ ] All event handlers produce the same observable result.
- [ ] All external library imports (e.g. `lucide-react`, `recharts`) are preserved in the components that use them.

## 6. Anti-patterns

| Anti-pattern | Why avoid |
|---|---|
| Generic hooks (`useApi`) | Lose page context; make business-rule tests hard. |
| Props passed more than 2 levels deep | Use Context or rethink composition past 3+ layers. |
| Form state split between hook and component | Keep state unified in the hook; the component gets values and callbacks. |
| Validation duplicated between hook and component | Validation lives in the hook (or pure helpers), never in JSX. |
| Components receiving `setState` directly | Pass callbacks (`onChange={...}`), never expose the React setter. |

## 7. Final example

```text
frontend/src/pages/
├── {Nome}Page.jsx              # Shim: export { default } from './{Nome}/index.jsx';
└── {Nome}/
    ├── index.jsx               # Orchestrator (~60-150 lines)
    ├── use{Nome}.js            # State + API + handlers
    ├── components/
    │   ├── {Nome}Table.jsx     # List/table
    │   ├── {Nome}Modal.jsx     # Modal container
    │   ├── {Nome}Form.jsx      # Form
    │   └── {Nome}Item.jsx      # Repeated sub-form (if any)
    └── utils/
        └── {nome}Helpers.js    # Pure functions
```
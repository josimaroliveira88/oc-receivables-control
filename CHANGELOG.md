# Changelog

All notable changes to the Receivables Control System are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Guidance for maintainers:

- This changelog does **not** keep a running `## [Unreleased]` section. When the user signals more adjustments may follow, the agent records what was just done in `NOTES.md` instead of editing `CHANGELOG.md`. When the user signals that no more adjustments are pending, those notes are consolidated into a new dated `## Phase N` section (most recent at the top) and grouped under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` as applicable. The agent then clears the entries from `NOTES.md`. See the **New Feature Workflow** in `AGENTS.md` for the full protocol.
- Keep each entry concise and actionable; refer to `AGENTS.md` for rules and `ARCHITECTURE.md` for system structure.
- Monetary amounts are in Brazilian Real (BRL) unless stated otherwise.


## Phase 66 — Menu de ações sem rolagem e fechamento educado de modais (2026-08-24)

### Added
- **Polite close em todas as modais com formulário**: fechar por backdrop, `Escape` ou botão `×`/Cancelar agora verifica se há alterações pendentes; se houver, abre um `ConfirmDialog` ("Descartar alterações?") antes de fechar; se não, fecha direto. `submitting` bloqueia o fechamento. Modais somente-leitura (Detalhamento, Histórico) fecham por backdrop sem confirmação.
- **`Modal` compartilhado** (`frontend/src/components/Modal.jsx`): wrapper único para todas as modais, centralizando o backdrop `z-[60]`, o clique no backdrop, o `Escape` e a lógica de descarte. Substitui `OrderModal`, `PersonModal` e `ProductModal` (removidos). Os filhos são passados como render prop `(requestClose) => ...` para que o botão Cancelar passe pela mesma checagem.
- **`useDirtyForm` + `hasFormChanges`** (`frontend/src/hooks/useDirtyForm.js`, `frontend/src/utils/formChanges.js`): comparação estrutural profunda (arrays/objetos aninhados) entre o estado atual e um snapshot que o hook de domínio captura ao abrir a modal e limpa ao fechar/salvar.
- **Modal de produto mais larga e reorganizada**: largura `max-w-2xl` (como o modal de pedidos) na criação e na edição, com os campos em duas colunas no desktop (`grid-cols-1 sm:grid-cols-2`) e empilhados no mobile.
- **Tipo de produto como radiobutton**: o seletor de tipo (`SIMPLES`/`KIT`) no formulário de produto virou um grupo de dois radiobuttons (reverter para `<select>` caso a quantidade de tipos aumente).

### Changed
- `frontend/src/components/ActionMenu.jsx`: o menu abre **para cima** (`bottom-full mb-2`) quando o gatilho está perto da base do viewport, mantendo as ações visíveis sem rolar e evitando que a altura da página aumente — corrige o bug em que clicar na barra de rolagem (ou scroll do mouse no último item) fechava o menu.
- `frontend/src/pages/Products/useProducts.js`: o status de edição (`editStatus`) agora entra no snapshot e na comparação de `editDirty`, para que mudar apenas o status marque a modal como suja (antes o fechamento por fora não detectava a alteração).
- `frontend/src/pages/Orders/useOrders.js`, `useOrderPayments.js`, `People/usePeople.js`, `Stock/useStock.js`: capturam snapshot ao abrir e expõem flags `isDirty` para o `Modal`.

### Removed
- `frontend/src/pages/Orders/components/OrderModal.jsx`, `frontend/src/pages/People/components/PersonModal.jsx`, `frontend/src/pages/Products/components/ProductModal.jsx` (substituídos pelo `Modal` compartilhado).

### Files touched
- `frontend/src/components/Modal.jsx` (novo), `frontend/src/hooks/useDirtyForm.js` (novo), `frontend/src/utils/formChanges.js` (novo).
- `frontend/src/components/ActionMenu.jsx`; modais de Orders (`PaymentModal`, `EditPaymentModal`, `DetailsModal`), People, Products (`ProductForm`), Stock (`MovementDialog`, `HistoryDialog`) e páginas `index.jsx` de Orders/People/Products/Stock.
- Hooks de domínio `useOrders`, `useOrderPayments`, `usePeople`, `useProducts`, `useStock`; `AGENTS.md` e `frontend/docs/frontend-architecture-guide.md`.

### Tests
- Frontend: novos `ActionMenu.test.jsx` (4), `Modal.test.jsx` (16), `formChanges.test.js` (13), `useDirtyForm.test.js` (6); `ProductsPage.test.jsx` com regressão de status + radiobuttons e `OrdersPayments.test.jsx` (confirmar descarte). **520 frontend passing** (was 475).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 65 — Edição sem reset de scroll no cadastro de produtos (2026-08-24)

### Changed
- **Edição sem recarregar a lista**: ao criar, editar ou trocar o status de um produto, a tabela não é mais recarregada nem desmontada (antes `loadProducts()` ligava `loading`, exibindo um spinner que resetava o scroll e recolhia a janela do scroll infinito para 20 linhas). Agora as mutações atualizam o item **localmente** em `allProducts` usando o produto completo retornado pelo backend (`projectCurrentPrice`), mantendo a posição de rolagem e a lista visível intactas.
- **Fluxo "Salvar e editar próximo"**: novo botão no modal de edição que salva o produto atual e abre imediatamente o modal de edição do próximo produto da lista filtrada, permitindo editar vários itens em sequência sem rolar. O botão fica desabilitado quando o produto em edição é o último da lista.

### Files touched
- `frontend/src/pages/Products/useProducts.js`: extração de `validateEditProduct`/`persistEditProduct`; atualização local em `handleCreateProduct`, `handleUpdateProduct` e `confirmChangeStatus`; novo `handleUpdateAndEditNext` e `hasNextProduct`.
- `frontend/src/pages/Products/components/ProductForm.jsx`: botão "Salvar e editar próximo" (só em edição, `disabled` no último item).
- `frontend/src/pages/Products/index.jsx`: conexão das novas props.

### Tests
- Frontend (`tests/ProductsPage.test.jsx`): 5 novos testes — criar/editar/trocar status atualizam localmente sem refetch (`mockGet` permanece 1 chamada), fluxo "Salvar e editar próximo" abre o próximo produto, e botão desabilitado ao editar o último; teste de scroll infinito pós-criação ajustado para não refetch. **480 frontend passing** (was 475).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 64 — Produtos do tipo Kit e estoque por componentes (2026-08-23)

### Added
- **Tipo de produto Kit**: novo `ProductType` (`SIMPLES` default | `KIT`) no cadastro de produtos (migração `20260823234735_add_kit_product_type`). Ao marcar um produto como Kit, o formulário abre o construtor de componentes (produtos simples + quantidade por componente); salvar é bloqueado enquanto não houver ao menos um componente vinculado. Kits não podem conter outros kits nem a si mesmos, e componentes só podem ser produtos simples.
- **Composição de kits**: nova tabela `KitComposition` (`kitProductId`, `componentProductId`, `quantity`, `@@unique([kitProductId, componentProductId])`). A composição atual pode ser substituída ao editar o produto; converter de Kit para Simples limpa a composição. O preço/PV do kit é informado manualmente (a composição não afeta o preço).
- **Escolha de envio ao estoque**: ao marcar um item de kit como "para meu estoque" (pessoa self), o formulário do pedido pergunta como enviar: **Estocar o kit** (`KIT`) ou **Estocar os componentes do kit** (`COMPONENTS`) — obrigatório antes de salvar. O backend exige `kitStockMode` para item `forStock` de produto Kit (400 caso ausente).
- **Snapshot congelado da composição**: o item de pedido grava `Item.kitSnapshot` (JSON) com a composição no momento da criação; `Item.kitStockMode` guarda a escolha. Alterações futuras na composição de um kit **não afetam** o controle de estoque de pedidos já cadastrados, mesmo ao editar itens desses pedidos.
- **Ajuste automático de estoque por kit**: criação/edição/exclusão de itens de kit aplicam movimentações por produto efetivo — em `COMPONENTS`, cada componente é estocado por `componentQty × itemQty` (ex.: 2 kits com 3 produtos ⇒ cada produto +2); em `KIT`, só o kit é estocado. Alterar quantidade, excluir o item/pedido ou trocar o modo `KIT` ↔ `COMPONENTS` ajusta o estoque de forma consistente.

### Changed
- `backend/src/controllers/productController.js`: `createProductSchema`/`updateProductSchema` aceitam `productType` e `components`; validações de composição; resposta inclui `productType` e `components`.
- `backend/src/utils/kitStock.js` (novo): `resolveKitSnapshot(client, productId)` e `expandItemToStockProducts(item)` — expansão única usada por `itemStockMovements`, `computeStockDiff` e exclusões de item/pedido.
- `backend/src/utils/stockDiff.js`: agregação por produto agora expande itens de kit via `expandItemToStockProducts`.
- `backend/src/controllers/ordersController.js`: `createOrder`/`addItemToOrder` congelam o snapshot e aplicam ENTRADA por produto efetivo; `updateItem` preserva o snapshot quando o produto não muda (regenera se mudar para outro kit; limpa se virar simples); `deleteItem`/`deleteOrder` revertem via expansão; `updateOrder` refatorado para **sync por id** (atualiza itens mantidos preservando `kitSnapshot`, cria novos, exclui removidos).
- `frontend/src/pages/Products/components/ProductForm.jsx`: seletor "Tipo de produto" e construtor de componentes (combobox de produtos simples + quantidade + Remover + Adicionar componente).
- `frontend/src/pages/Products/useProducts.js` + `utils/productHelpers.js`: payload com `productType`/`components`, validação de ≥1 componente, carregamento da composição ao editar.
- `frontend/src/pages/Orders/components/OrderItemFields.jsx`: rádio "Estocar o kit / Estocar os componentes do kit" quando `self + forStock + kit`.
- `frontend/src/pages/Orders/useOrders.js` + `utils/orderHelpers.js`: `itemPayload` envia `id` (UUID) e `kitStockMode`; validação exige o modo; reset do modo ao trocar produto/pessoa.
- `ARCHITECTURE.md` e `AGENTS.md` atualizados com o modelo de kits, o snapshot congelado, o sync por id e os pitfalls de teste.

### Tests
- Backend: `tests/kitProducts.test.js` (17) — CRUD de kit, validações de composição, troca de tipo; `tests/kitStock.test.js` (9) — `expandItemToStockProducts`/`resolveKitSnapshot`; `tests/ordersKit.test.js` (16) — ENTRADA/SAIDA em KIT vs COMPONENTS, multiplicador `componentQty × itemQty`, updateItem quantidade/modo/produto, delete item/pedido, snapshot congelado após mudança de composição, sync por id no `updateOrder`; `tests/stockDiff.test.js` estendido com casos de kit. **390 backend passing** (was 343).
- Frontend: `tests/ProductsPage.test.jsx` — novo bloco "Kit product form" (6) cobrindo o seletor de tipo, construtor, validação e payload; `tests/OrdersPage.test.jsx` — novo bloco "Kit stock mode selection" (5) cobrindo o rádio, obrigatoriedade e pré-preenchimento na edição. **475 frontend passing** (was 464).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 63 — Edição de pagamentos, Frete no pedido, PV zero e Data Efetiva no estoque (2026-08-23)

### Added
- **Edição de pagamentos recebidos**: novo endpoint autenticado `PUT /api/orders/payments/:id` para editar valor (`amount`), data (`paidAt`) e observação (`notes`) de um pagamento recebido, mantendo a pessoa (`personId`) fixa. O status do pedido é recalculado na mesma transação (ex.: `QUITADO` → `PARCIAL` ao reduzir o valor, `PARCIAL` → `QUITADO` ao completar o saldo), valor zero é rejeitado para pessoa com itens cobráveis e o pagamento é escopado por `req.user.userId` (404 para inexistente ou de outro usuário).
- No modal de Detalhamento, cada pagamento recebido agora exibe um ícone de lápis que abre o modal **"Editar Pagamento"** com os campos pré-preenchidos; validações espelham a criação (valor negativo, zero para itens cobráveis) e o overpayment reutiliza o `ConfirmDialog`. Após salvar, o detalhamento é atualizado localmente e o status do pedido re-renderizado, com toast de sucesso.
- **Campo Frete (R$)** no pedido: `Order.shippingValue` (`Decimal(10,2)`, default 0, migração `20260823100000_add_order_shipping_value`) informado ao criar/editar um pedido. O frete entra no `totalValue`, no saldo pendente e no fluxo de pagamento; pedidos com itens cobráveis não-self só ficam `QUITADO` quando os pagamentos cobrem itens + frete (pedidos só-self/gift não são bloqueados). O campo aparece em novo bloco inferior (`OrderTotals.jsx`, testid `order-freight`) ao lado dos somadores read-only `Soma dos Produtos` e `Soma dos PV`; os modais de Pagamento e Detalhamento exibem a linha **Frete** (`order-summary-shipping` / `details-summary-shipping`).
- **Regra de PV zero**: se o Valor Cobrado do item for zero, o PV é zero. O helper `effectivePvCents` (backend `utils/money.js` + frontend `orderHelpers.js`) aplica a regra no campo PV por item, nos dois blocos de soma, na coluna `PV Total` e na ordenação `totalPv` do backend.
- **Data Efetiva nas movimentações de estoque**: nova coluna `StockMovement.effectiveDate` (`DateTime`, default `now()`, migração `20260823193525_add_stock_movement_effective_date` + índice `[userId, effectiveDate]`). No formulário manual de movimentação, o campo **"Data Efetiva"** é obrigatório e vem pré-preenchido com a data atual (sem restrição de datas futuras); o `createdAt` continua registrando o momento da inserção. Movimentações geradas por pedido usam **sempre a `orderDate` do pedido**, com guarda que retorna `400 Data do pedido é obrigatória para movimentações de estoque` se essa data estiver ausente.

### Changed
- `backend/src/services/stockService.js`: `applyMovement` aceita `effectiveDate` opcional (default `new Date()`).
- `backend/src/controllers/StockController.js`: `movementSchema` aceita `effectiveDate` (`YYYY-MM-DD`, regex) e `registerMovement` o persiste via `parseLocalDate`.
- `backend/src/controllers/ordersController.js`: todos os pontos de integração order↔stock propagam `effectiveDate = order.orderDate`; `parseLocalDate` extraído para `backend/src/utils/date.js` (compartilhado com `StockController` e `paymentsController`).
- `frontend/src/pages/Stock/components/MovementDialog.jsx`: novo campo "Data Efetiva"; `HistoryDialog.jsx`: duas colunas de data — **"Data Efetiva"** e **"Data de Registro"** (mantém `createdAt`) — com a data de registro em quebra de linha automática.
- `frontend/src/pages/Stock/utils/stockHelpers.js`: novos `formatDate` e `todayLocalDate`; `emptyMovementForm`, `buildMovementPayload` e `validateMovement` estendidos.
- `ARCHITECTURE.md` atualizado com o campo `effectiveDate` e as convenções de data do estoque.

### Fixed
- Barra de rolagem horizontal na modal de detalhamento do histórico de estoque, causada pela coluna de data de registro com `whitespace-nowrap`; removida a regra de no-break (quebra automática) e adicionado `overflow-x-hidden` ao container do modal.

### Tests
- Backend (`tests/stock.test.js`): persistência de `effectiveDate` informada, default para a data atual e rejeição de formato inválido (400). Backend (`tests/ordersStock.test.js`): `effectiveDate` igual à `orderDate` na criação e a data alterada propagada nas movimentações do `updateOrder`. **343 backend passing** (was 337).
- Frontend (`tests/StockPage.test.jsx`): campo Data Efetiva pré-preenchido com a data atual, envio da data escolhida no payload do `POST /stock/movements` e renderização das duas colunas de data no histórico. **464 frontend passing** (was 461).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 62 — Observação no cadastro de clientes (2026-08-23)

### Added
- Campo opcional **Observação** no Cadastro de Clientes (textarea de até 2000 caracteres) para o usuário armazenar informações gerais do cliente; valores vazios são normalizados para `null` ao salvar.
- Coluna **Observação** na tabela de clientes exibindo o texto truncado, com o conteúdo completo disponível via tooltip ao passar o mouse; quando vazio, mostra `—`.
- A observação entra na exportação Excel (aba Clientes, coluna entre Endereço e VIP) e na busca por `q` tanto no backend (`GET /api/people`) quanto no filtro do frontend.
- Migração `backend/prisma/migrations/20260822100000_add_person_observacao/migration.sql` adicionando a coluna anulável `observacao VARCHAR(2000)` ao modelo `Person`.

### Changed
- `backend/src/controllers/peopleController.js`: validação Zod de `observacao` (máx. 2000 caracteres) e `findIdsByTextSearch` passou a casar também esse campo.
- `frontend/src/pages/People/components/PeopleTable.jsx`: larguras de coluna rebalanceadas para acomodar a nova coluna Observação.

### Tests
- Backend (`tests/people.test.js`): criação com `observacao`, default `null`, rejeição com 2001 caracteres, `GET` por id, busca por `observacao`, atualização incluindo o campo e limpeza explícita com `null`. **299 backend passing** (was 293).
- Frontend (`tests/PeoplePage.test.jsx`, `tests/exportExcel.test.js`): round-trip no formulário (criar/editar), renderização da célula na tabela, busca por Observação e headers/linhas/larguras da aba Clientes. **443 frontend passing** (was 419).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 61 — Loyalty points column on the Products screen (2026-08-23)

### Added
- **Pontos** column on the Cadastro de Produtos screen showing the predicted loyalty points a product would accumulate, computed as `PV × tier percentage`, where the percentage follows the dōTERRA order-regularity program: 10% (meses 1–3), 15% (meses 4–6), 20% (meses 7–9), 25% (meses 10–12) and 30% (a partir do 13º mês). Values are displayed in pt-BR with two decimal places (e.g. `3,10`).
- **Regularidade** select in the table toolbar letting the user pick the current regularity tier; a short explanatory line under the select updates with the chosen tier (e.g. `15% do PV nos meses 4–6 • mínimo 50 PV por pedido`).
- The whole points feature is **hidden by default**: a subtle **Pontos** button (eye icon) in the toolbar toggles the column, the Regularidade select and its explanatory text on/off (`aria-pressed`).
- Products with `PV < 50` are highlighted in amber with a tooltip explaining that, on their own in a single order, they would not reach the 50 PV monthly minimum required to accumulate points (the minimum applies to the whole order, so the per-product calculation is unchanged).

### Changed
- Pure helpers added to `frontend/src/pages/Products/utils/productHelpers.js`: `LOYALTY_TIERS`, `getLoyaltyTier`, `calculatePoints`, `formatPoints`, `isBelowMinimumPv` and `getLoyaltyTierDescription`. State (`loyaltyTier`, `showPointsColumn` + `togglePointsColumn`) lives in `useProducts.js`; `ProductsTable.jsx` rebalanced column widths to make room for the new column (Código 6 / Site 4 / Produto 22 / Tamanho 8 / Preço Regular 9 / Preço Membro 9 / PV 5 / R$/PV 7 / Pontos 8 / Status 12 / Ações 10).

### Tests
- `frontend/tests/ProductsPage.test.jsx`: new "Loyalty points column" block covering the hidden-by-default behavior and the toggle, the tier select and its explanatory text, PV×percentage rendering for the 1–3 and 13+ tiers (no extra API call), and the amber highlight/tooltip for PV below 50. **428 frontend passing** (was 420).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 60 — R$/PV column on the Products screen (2026-08-23)

### Added
- **R$/PV** column on the Cadastro de Produtos screen: `memberPrice / pv`, computed on the backend at API projection time using integer/`BigInt` arithmetic (no floating-point), rounded half-up to two decimal places, and returned as a string in the product payloads (`GET /api/products`, `GET /api/products/:id`, create/update responses). A product with null/zero PV (or no current price) returns `null`, shown as `—` in the UI.
- Sorting by R$/PV (asc/desc) on both the server (`sortBy=pricePerPv`) and the client-side sort dropdown (`R$/PV (menor)` / `R$/PV (maior)`).
- `backend/src/utils/money.js` gained `pricePerPv(memberPrice, pv)`; `backend/src/controllers/productController.js` projects the derived `pricePerPv` field and includes it in the numeric sortable fields.

### Changed
- Products table column order is now Código, Site, Produto, Tamanho, Preço Regular, Preço Membro, PV, R$/PV, Status, Ações, with widths rebalanced (`frontend/src/pages/Products/components/ProductsTable.jsx`).
- `ARCHITECTURE.md` updated to document the derived `pricePerPv` field.

### Tests
- Backend (`tests/products.test.js`): R$/PV on create with exact division and half-up rounding, `null` for zero PV, and server-side sorting by `pricePerPv`. **295 backend passing**.
- Frontend (`tests/ProductsPage.test.jsx`): R$/PV rendered with BRL formatting, `—` placeholder when unavailable, and the product-column selector updated for the new column order. **420 frontend passing**.
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 59 — Accent-insensitive search across list endpoints (2026-08-21)

### Fixed
- The `q` text search on `GET /api/people`, `GET /api/orders` (per `searchField` column) and `GET /api/stock` is now accent- and case-insensitive: searching for "Cássia" or "Cassia" both find records stored as "Cassia" or "Cássia". Previously `mode: 'insensitive'` only handled case folding, so accented terms did not match unaccented data (and vice versa).

### Added
- New migration `backend/prisma/migrations/20260821180000_enable_unaccent_extension/migration.sql` enables the PostgreSQL `unaccent` extension (idempotent `CREATE EXTENSION IF NOT EXISTS unaccent`).
- New shared helper `backend/src/utils/search.js` exporting `findIdsByTextSearch` (raw `SELECT id WHERE unaccent(lower(col)) LIKE unaccent(lower(?))` with LIKE-wildcard escaping) and `escapeLikePattern`. The three list controllers now route the `q` parameter through it and combine the returned IDs with the existing Prisma `where` (userId + classification / status / paymentType) via `id IN (...)`. No schema/model changes; existing user data is untouched.

### Tests
- Backend: added 6 accent-insensitive cases (2 per endpoint covering accented→unaccented and unaccented→accented) in `tests/people.test.js`, `tests/orders.test.js`, and `tests/stock.test.js`. **293 backend passing** (was 287).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean, backend `npm run test` 293/293, frontend `npm run test` 419/419.


## Phase 58 — Search, filters and sorting on Clients, Orders, and Stock screens (2026-08-21)

### Added
- **Clients screen**: search box that filters in real time as the user types (name or WhatsApp, case-insensitive, client-side like Products) plus a **Classificação** dropdown (Todas / Somente VIP / Somente Membro doTERRA / VIP + Membro / Sem classificação) mapped to the existing `isVip`/`isDoterraMember` flags. Every data column (Nome, Grupos, WhatsApp, Instagram, Endereço, VIP, Membro doTERRA) is now a clickable sort header that toggles asc/desc.
- **Stock screen**: search box (product code or name, as-you-type, client-side) and clickable sort headers for Código, Produto, Tamanho and Estoque Atual.
- **Orders screen**: a filter bar with a search input plus a column selector (Todas as colunas / Número / Responsável / Descrição) that submits on Enter or the **Pesquisar** button, and **Status** + **Tipo de Pagamento** dropdowns that refetch immediately. All data columns (Número, Data, Responsável, Tipo Pgto, Valor, Valor Pendente, PV Total, Descrição, Status) are clickable sort headers. **Server-side**: every request combines the active filters and sort into a single `GET /api/orders` call (e.g. filter + sort applied together), with an `AbortController` cancelling in-flight requests on rapid changes; the filtered empty state shows "Nenhum pedido encontrado para os filtros aplicados."
- New shared widgets `frontend/src/components/SortableHeader.jsx` (clickable `th` with `aria-sort` and asc/desc icons) and `frontend/src/components/SearchInput.jsx`; new hook `frontend/src/pages/Orders/useOrderFilters.js` owning the orders filter/sort state and query-param builder.

### Changed
- Backend query support on three list endpoints (all still scoped by `req.user.userId`):
  - `GET /api/people` now accepts `q` (name/WhatsApp `contains`, case-insensitive), `classification` (`vip` | `member` | `vip_member` | `none`), `sortBy`, and `sortDir` (default `name asc`).
  - `GET /api/stock` now accepts `q` (product code/name via the `product` relation), `sortBy` (`code` | `name` | `size` | `quantity`), and `sortDir`.
  - `GET /api/orders` now accepts `q` + `searchField` (`all` | `orderNumber` | `accountOwner` | `orderNotes`), `status` (single or comma-separated), `paymentType`, `sortBy`, and `sortDir`. The computed columns `pendingValue` (total − self − paid) and `totalPv` (Σ item.pv × qty) are sorted in-memory after the filtered Prisma query; other fields use Prisma `orderBy`.
- `frontend/src/pages/People/`, `frontend/src/pages/Stock/`, and `frontend/src/pages/Orders/` updated to the client-side (People/Stock) and server-side (Orders) filter/sort flows described above; the orders status filter labels use "Somente ..." to avoid clashing with row badges.
- `ARCHITECTURE.md` updated with the new query params on `/api/people`, `/api/orders`, `/api/stock`, the server-side orders fetch strategy, and the new shared widgets/hook.

### Tests
- Backend: new search/filter/sort blocks in `tests/people.test.js` (name/WhatsApp search, classification combos, sort + fallback, combination, isolation), `tests/stock.test.js` (name/code search, quantity/name sort, isolation), and `tests/orders.test.js` (per-column search, default-all search, status/paymentType filters, filter+sort combination, computed pendingValue sort, isolation). **287 backend passing** (was 286).
- Frontend: new shared-widget tests in `tests/SearchSortComponents.test.jsx`; search/classification/sort blocks in `tests/PeoplePage.test.jsx`; search/sort blocks in `tests/StockPage.test.jsx`; server-side search/filter/sort blocks in `tests/OrdersPage.test.jsx` (request params, immediate refetch on filter/sort, combined filter+sort request, direction toggle, filtered empty state). **419 frontend passing** (was 395).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean, backend `npm run test` 287/287, frontend `npm run test` 419/419.


## Phase 57 — Unified status editor on the Products screen (2026-08-21)

### Changed
- The **STATUS** column on the Products screen is now a clickable status badge that opens a dropdown with the possible statuses (Ativo, Indisponível, Inativo). Selecting an option keeps the confirmation dialog and persists via `PUT /products/:id`; selecting the current status just closes the menu. The standalone status `<select>` was removed from the **Ações** column, so the status display and its editor live in a single column.
- Table column widths rebalanced for the new layout (Produto 26%→30%, Tamanho 7%→12%, Status 12%→11%, Ações 16%→8%; total still 100%), giving the product name and size more room now that the **Ações** column no longer holds the combobox.
- New `frontend/src/pages/Products/components/StatusBadgeDropdown.jsx` replaces the display-only `StatusBadge.jsx` (removed); `frontend/src/pages/Products/components/ProductsTable.jsx` updated accordingly.

### Tests
- `frontend/tests/ProductsPage.test.jsx`: the inline status-change tests now drive the badge dropdown, with added cases for opening the menu, selecting the current status (no dialog), and closing via backdrop. Verification: 395 frontend tests passing, `npm run build` clean, `npm run format:check` clean.


## Phase 56 — Order-to-stock for the user's own items; item quantity and price mode (2026-08-21)

### Added
- `Item` now carries `quantity` (integer ≥ 1, default 1), `forStock` (boolean), and `chargedValueMode` (`UNIT` | `TOTAL`, default `UNIT`). In `UNIT` mode `chargedValue` is the per-unit price (line total = `chargedValue × quantity`); in `TOTAL` mode it is the full line value. Migration `20260821175425_add_order_stock_quantity_fields` (additive, safe for `prisma migrate deploy`; existing items remain qty=1/UNIT so financial totals are preserved).
- `StockMovement` gained nullable `orderId`/`itemId` relations (`ON DELETE SET NULL`) so movements generated by an order are distinguishable from manual ones and survive order/item deletion for audit history.
- **Order ↔ Stock integration** (backend, transactional): when an order contains a self-person item flagged `forStock` with a catalog product, `ordersController` creates an `ENTRADA` `StockMovement` (`reason: "Pedido <orderNumber>"`) inside the same `prisma.$transaction` as the order/item mutation. On `updateOrder` (destructive full replacement), `addItemToOrder`, `updateItem`, `deleteItem`, and `deleteOrder`, the net per-product stock delta is computed (pure `computeStockDiff` in `backend/src/utils/stockDiff.js`) and `ENTRADA`/`SAIDA` movements are applied. Stock reversals are blocked with `400 Insufficient stock` and an orientative message ("Corrija o estoque do produto <name> na tela de Estoque e tente novamente") when the deduction would make stock negative.
- New `backend/src/services/stockService.js` (`applyMovement(client, ...)`) — the canonical transactional movement primitive shared by `StockController.registerMovement` and `ordersController`. New `lineValueCents(item)` in `backend/src/utils/money.js` (integer cents honoring `UNIT`×quantity vs `TOTAL`); `computeOrderStatus`, payment balance/item totals, order `totalValue`, and `getOrderBalance` all use it.
- **Order form**: new **Quantidade** input (testid `order-item-quantity-{index}`), a **"Este item é para meu estoque"** checkbox shown only when the item's person is the user themselves (testid `order-item-stock-toggle-{index}`), a **"O valor cobrado é"** selector `UNIT`/`TOTAL` (testid `order-item-price-mode-{index}`), and read-only **Valor Cobrado (total)** / **Valor Membro (total)** displays (`memberPrice × quantity`). `calculateTotal`/`calculateTotalPV` now honor quantity and mode; `Soma dos Produtos`/`Soma dos PV` gained testids `order-totals-charged`/`order-totals-pv`. Switching the person away from self resets `forStock`.
- **Stock history**: movements generated by an order show a **"Pedido #X"** badge (`movement-order-{type}`); when the latest movement is order-generated, the history dialog hides the undo button and shows an info card with the order number plus a **"Ver pedido"** button (testid `go-to-order-from-history`) that deep-links to `/orders?editOrder=<id>` and auto-opens the edit modal.

### Changed
- `backend/src/controllers/ordersController.js`: all mutation handlers (`createOrder`, `updateOrder`, `addItemToOrder`, `updateItem`, `deleteItem`, `deleteOrder`) now run inside `prisma.$transaction`, compute `totalValue` in integer cents via `lineValueCents`, and validate `forStock` (only allowed for the self person and only with a catalog product). `itemSchema` gained `quantity`, `forStock`, `chargedValueMode`.
- `backend/src/controllers/StockController.js`: `registerMovement` delegates to `applyMovement`; `getProductHistory` now includes `order: { id, orderNumber }`; `undoLastMovement` rejects order-generated movements (`400` with `orderNumber`/`orderId` in the body) — reversal happens exclusively through the order.
- Frontend financial math: `getOrderSelfCents` uses `lineValueCents`, `getOrderTotalPV` multiplies by quantity, and `DetailsModal`/`PaymentModal` display line totals and quantity.
- `ARCHITECTURE.md` updated with the new schema fields/relations, the `lineValueCents` rule, the transactional order↔stock integration, the undo guard, and the `?editOrder=` deep-link.

### Fixed
- Order create and update now emit a success toast (`"Pedido criado com sucesso!"` / `"Pedido atualizado com sucesso!"`) so the user gets explicit confirmation instead of only the modal closing.

### Tests
- Backend: new `tests/stockDiff.test.js` (pure `computeStockDiff`, 10 tests) and `tests/ordersStock.test.js` (20 tests: self+forStock create/add/update/delete, validation rules, UNIT/TOTAL totals, diffs 5→3 and product change, insufficient-stock blocks, user isolation, undo guard and order info in history); `tests/stock.test.js` extended (manual movements have null `orderId`/`itemId`). **262 backend passing** (was 232).
- Frontend: `tests/OrdersPage.test.jsx` gained quantity default/validation, self-only toggle + reset on person switch, payload with `quantity`/`forStock`/`chargedValueMode`, no frontend call to `/stock/movements`, UNIT vs TOTAL totals, member total = memberPrice × quantity, and edit prefill; `tests/StockPage.test.jsx` gained order-locked notice with order number + "Ver pedido", no undo button, and per-row "Pedido #X" badge. **392 frontend passing** (was 379).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean, backend `npm run test` 262/262, frontend `npm run test` 392/392.

## Phase 55 — Per-item order validation errors and error-persistence cleanup (2026-08-21)

### Fixed
- Form-validation errors no longer persist: in Orders, People, and Products the `error` state was set but never cleared, so a failed validation stayed visible after the user fixed the field and even on the next modal open (the edit modal could open already showing an old error). Errors are now cleared on any field/item change, on modal open, and on reset.
- The order modal now shows **per-item** validation errors instead of a single banner above the whole items list: each invalid item card renders its own inline message — `"Pessoa é obrigatória"` or `"Valor não pode ser negativo"` — with a red border, and the form auto-scrolls to the first invalid item. The `"Número do pedido é obrigatório"` message is shown inline right below the order-number field.

### Changed
- Backend submit failures (`"Erro ao criar/atualizar/excluir pedido/cliente/produto"` and product status change) can't be reliably tied to a specific item/field, so they now surface as an error toast (`z-[90]`) instead of the inline banner. The page-level banner remains only for page-level load failures.
- `OrderForm`/`OrderItemFields` accept per-item errors (`itemErrors` keyed by item id) and an `orderNumberError`; `OrderItemFields` gained `data-testid="order-item-{index}"`. People and Products clear their error on field change/modal open and route backend failures to toasts.

### Tests
- `OrdersPage.test.jsx`: per-item error on the card, order-number error inline, error clears when the item is fixed, and backend failure renders as a toast.
- `PeoplePage.test.jsx` and `ProductsPage.test.jsx`: error clears when typing and backend failure renders as a toast.
- Verified: frontend `379 passed`, `npm run build` clean, and Prettier `format:check` clean.

## Phase 54 — Render modal form errors inside the modal (2026-08-21)

### Fixed
- Order, People, and Products edit/create modals surfaced form-level validation and submit errors in the **page-level** banner rendered above the table, which sat behind each modal's full-screen `z-[60]` backdrop with `bg-black/40 backdrop-blur-sm` — so the message appeared dimmed/blurred and partially hidden. These errors are now rendered **inside** the modal form (OrderForm above the "Itens do Pedido" heading; PersonForm and ProductForm at the top of the form), and the page-level banner is suppressed while a modal is open, remaining reachable only for true page-level errors (load failures).
- Messages affected: `"Número do pedido é obrigatório"`, `"Preencha todos os campos dos itens corretamente"`, `"Erro ao criar/atualizar/excluir pedido"` (Orders); `"Nome é obrigatório"`, `"Erro ao criar/atualizar cliente"` (People); `"Código é obrigatório"`, `"Nome é obrigatório"`, `"Tamanho é obrigatório"`, `"URL do produto inválida"`, `"Erro ao criar/atualizar produto"` (Products). The Stock page was audited and is not affected: its dialogs already render their own inline errors and its page-level error only fires on inventory-load failure.

### Changed
- `OrderForm`, `PersonForm`, and `ProductForm` accept a new `error` prop and render a banner (`data-testid="order-form-error"`, `"person-form-error"`, `"product-form-error"`); the page-level banner in `Orders/index.jsx`, `People/index.jsx`, and `Products/index.jsx` is gated on `!(showCreateModal || showEditModal)`.

### Tests
- `frontend/tests/OrdersPage.test.jsx`, `frontend/tests/PeoplePage.test.jsx`, and `frontend/tests/ProductsPage.test.jsx` each gained "should render the form validation error inside the modal (not behind it)", asserting the validation error appears inside the `fixed inset-0 z-[60]` modal dialog.
- Verified: frontend `373 passed`, `npm run build` clean, and Prettier `format:check` clean. The Order case was visually verified with Playwright (error banner inside the modal and `elementFromPoint` hits the error's own text element while the modal keeps its `backdrop-filter: blur(4px)`).

## Phase 53 — Toasts above modal overlays (2026-08-21)

### Fixed
- Error and success toasts fired from actions inside modals were rendered behind the modal's full-screen backdrop (`z-[60]` with `bg-black/40 backdrop-blur-sm`), appearing dimmed/blurred or hidden. The toast container (`frontend/src/components/Toast.jsx`) moved from `z-50` to `z-[90]`, the new topmost layer of the stacking hierarchy (above action menus at `z-[80]`, confirmation/tour overlays at `z-[70]`, and modals at `z-[60]`), so toasts always render crisp and clickable regardless of which overlay is open.

### Changed
- `AGENTS.md` z-index hierarchy rule updated to include toasts at `z-[90]`.

### Tests
- New `frontend/tests/Toast.test.jsx`: error and success toast rendering via the `useToast` context, container positioned at `z-[90]` above all overlay layers, and no own backdrop-blur on the toast.
- Verified: frontend `370 passed`, `npm run build` clean, and Prettier `format:check` clean. Visually verified with Playwright against the running app: error toast fired from the payment modal renders as the topmost element (`elementFromPoint` hits the toast; toast `z-index: 90` without blur over the modal's `z-index: 60` with `blur(4px)`).

## Phase 52 — Self person as an order item owner (2026-08-21)

### Added
- `Person.isSelf` flag (migration `20260821120000_add_person_is_self`): marks the logged-in user's own Person record, at most one per user (create/update automatically unset any previous self person). New endpoint `POST /api/people/self` returns the existing self person or creates it named after the user's `username`.
- Shared helper `backend/src/utils/receivables.js` (`computeOrderStatus`, `personPendingCents`, `syncOrderStatusesForPersons`) centralizing the rule that items assigned to the self person are treated as already received.
- Order form: the item's person `<select>` always offers the user as the first option — "Eu (você)" when no self person exists (auto-creates it via `POST /api/people/self` on first selection) or "Nome (Você)" when it does. The People form gained an "Esta pessoa sou eu" checkbox to consolidate/transfer the flag.
- Payment and details modals show "(Você)" and "Recebido" for the self person, and the payment form blocks registering a payment for the self person.

### Changed
- Order status is now computed at creation (an order containing only self items starts `QUITADO`) and recomputed on order/item create/update/delete instead of only on payment registration; toggling a person's `isSelf` recomputes the status of all affected orders.
- Pending calculations treat self items as received everywhere: per-person order balance (`GET /api/orders/:id/balance`, now exposing `isSelf` with `pending: 0`), the `createPayment` status recompute, and dashboard `totalPending`/`personBalances`/`yearlyBreakdown`. No `Payment` record is created, so `currentMonthReceipts` is unaffected.
- Client-side order pending helpers (`getOrderPendingCents`/`getOrderFinancials`) exclude self-item values, and the dashboard chart marks the self person as "(Você)".

### Tests
- Backend: 11 new unit tests for `backend/src/utils/receivables.js`; `isSelf` create/update/uniqueness plus `POST /api/people/self` in `people.test.js`; self-item order statuses (create and edit) in `orders.test.js`; self-person payment status and balance in `payments.test.js`; dashboard self-person exclusion (totals, per-person, yearly, receipts) in `dashboard.test.js`.
- Frontend: "Eu (você)" option, auto-creation, and "(Você)" binding in `OrdersPage.test.jsx`; "Esta pessoa sou eu" payload in `PeoplePage.test.jsx`; "(Você)"/"Recebido" display in payment and details modals in `OrdersPayments.test.jsx`.
- Verified: backend `232 passed`, frontend `366 passed`, `npm run build` clean, and Prettier `format:check` clean.

## Phase 51 — Stock control: database, /api/stock, page, and undo (2026-08-20)

### Added
- Isolated stock-control database layer: enum `StockMovementType` (`ENTRADA`, `SAIDA`, `AJUSTE`), `Inventory` (current balance, one row per user+product via `@@unique([userId, productId])`) and `StockMovement` (signed-quantity history), both scoped by `userId`. Relation arrays `inventory`/`stockMovements` added to `User` and `Product` (no new business fields). Migration `20260820161530_create_inventory_tables`. FK decisions: `productId` `onDelete: Restrict` (products are deactivated, not deleted), `userId` `onDelete: Cascade`.
- Backend area `/api/stock` (scoped by `req.user.userId`): `listInventory`, `getProductHistory`, and `registerMovement` — the latter runs in a single `prisma.$transaction` that validates the global `Product`, computes the signed quantity and new balance (`ENTRADA` `+q`, `SAIDA` `-q` forbidding negative stock, `AJUSTE` sets absolute target with signed delta), creates the `StockMovement`, and upserts the `Inventory`. Zod validation (`productId` UUID, `type` enum, integer `quantity`, `reason` ≤ 255).
- Undo endpoint `POST /api/stock/movements/:id/undo`: undoes the **last** movement of a product in a single transaction. Rejects `404` when the movement does not exist or belongs to another user, and `400` ("Apenas a última movimentação pode ser desfeita") when a newer movement exists (count of movements with `createdAt` greater). Reverses the `Inventory` balance (`quantity − movement.quantity`; negative → `400`), and deletes the `Inventory` row when the undone movement was the only one, so the product leaves the stock list and becomes available for a fresh initialization.
- Frontend Stock page (`frontend/src/pages/Stock/`): page orchestrator (`index.jsx`, `useStock.js`, `components/StockTable.jsx`, `MovementDialog.jsx`, `HistoryDialog.jsx`, `utils/stockHelpers.js`) plus the `StockPage.jsx` shim, route `/stock`, and the "Estoque" nav item (Header + MobileDrawer).
- "Adicionar Estoque" initialization flow: button in the page header opens the movement dialog with a product combobox listing all catalog products (any status) not yet in the user's inventory (`availableProducts`, catalog loaded lazily via `GET /products?pageSize=all` on dialog open). When opened from a product row's kebab the dialog shows a read-only "Produto: {name} ({code})" line instead. `productId` is required by `validateMovement` ("Produto é obrigatório").
- "Desfazer última movimentação" button in the `HistoryDialog` (visible only when `history.length > 0`), backed by the shared `ConfirmDialog` (confirmLabel "Desfazer", loading during the call). After confirming, the movement history and inventory reload so the new last remaining movement can be undone again sequentially; undoing the only movement removes the product from the stock list (the `404` from the history reload is treated as empty history).

### Changed
- `ProductCombobox` promoted from `frontend/src/pages/Orders/components/` to the shared `frontend/src/components/ProductCombobox.jsx`, gaining an optional `subtitle` prop (default: regular price) and `aria-label="Produto"`. `OrderItemFields.jsx` now imports the shared component (behavior unchanged).
- `MovementDialog` renders the product combobox (subtitle = product size) when no product is selected, versus a read-only product line in kebab mode.

### Tests
- Backend: 22 new tests for `/api/stock` (auth `401`/`403`, `ENTRADA`/`SAIDA`/`AJUSTE` with transactional consistency and negative-stock rejection, Zod validation, inventory/history user isolation, and A/B user isolation) plus 9 new tests for the undo endpoint (`401`; `ENTRADA` undone decrements; `SAIDA` undone increments; `AJUSTE` undone reverts to previous value; only-movement deletes the `Inventory`; non-last → `400` without partial writes; sequential double undo; `404` not found; `404` other user).
- Frontend: 25 new tests in `frontend/tests/StockPage.test.jsx` for the stock page (list, register movement via kebab, validation, history dialog), 6 for "Adicionar Estoque" (button renders; dialog with combobox and `ENTRADA` preselected; `productId` required without POST; happy path reloads `/stock`; unavailable products not listed; `AJUSTE` sets the absolute initial balance), and 7 for "Undo last movement" (button visible/invisible; `ConfirmDialog` opens with product name; cancel makes no POST; confirm POSTs + toasts + reloads history and inventory; sequential undo keeps the button; only-movement removes the row and hides the button). Header/MobileDrawer tests updated for the new nav item.
- Verified: backend `199 passed`, frontend `360 passed`, `npm run build` clean, and Prettier `format:check` clean.

## Phase 50 — Move order tracking link to order number (2026-08-20)

### Changed
- Removed the separate "Rastreio" column from Gestão de Pedidos and moved its tracking link to the "Número" column, using the order number to build the URL.
- Increased the "Número" column width to 11%, prevented long order numbers from wrapping, reduced the external-link icon, and right-aligned the column on desktop while preserving left alignment on mobile. The number and icon use fixed visual areas so order numbers of different lengths remain aligned.

### Tests
- Updated `frontend/tests/OrdersPage.test.jsx` to verify the tracking links are attached to each order number and that the separate column is absent.
- Verified: 322 frontend tests passing, `npm run build` clean, and Prettier `format:check` clean.


## Phase 49 — Unify Receivables into the Orders page (2026-08-20)

### Changed
- Removed the "Recebíveis" menu item (header and mobile drawer), the `/receivables` route, and the `ReceivablesPage` shim, unifying receivables management under the "Pedidos" page (`/orders`), since the two lists were practically identical and differed only in their actions.
- The unified orders list now shows the columns: Número, Data, Responsável, Tipo Pgto, Valor, Valor Pendente, PV Total, Descrição, Rastreio, Status, Ações. Row actions are now: Registrar Pagamento (or "Dar baixa", shown conditionally), Detalhar Pagamentos, Editar, and Excluir.
- Payment registration and the per-person details modal were carried over exactly as implemented, preserving their behavior unchanged; only the action label "Detalhar" was renamed to "Detalhar Pagamentos".
- `frontend/src/pages/Orders/`: `useOrders.js` now exposes `refreshOrders` (refetch orders after a payment); new `useOrderPayments.js` hook owns the payment and details state; `PaymentModal.jsx`, `DetailsModal.jsx`, and `utils/receivablesHelpers.js` were moved in from the removed `Receivables/` folder; `OrdersTable.jsx` gained the "Valor Pendente" column and the two new actions; `index.jsx` composes both hooks and renders the payment/details modals and the overpayment confirmation.
- `frontend/src/App.jsx` (removed route), `frontend/src/components/Header.jsx` and `MobileDrawer.jsx` (removed nav item and unused icon import), and `frontend/src/components/OnboardingTour.jsx` (payment step now points to `/orders`).
- `ARCHITECTURE.md`: page tree updated to reflect the merged `Orders/` folder and the removal of `Receivables/`.

### Removed
- `frontend/src/pages/Receivables/` (index.jsx, useReceivables.js, components/, utils/receivablesHelpers.js) and the `frontend/src/pages/ReceivablesPage.jsx` shim.

### Tests
- `tests/OrdersPage.test.jsx` updated for the new action set and the added "Valor Pendente" column.
- New `tests/OrdersPayments.test.jsx` covers payment registration, overpayment confirmation, and the details modal (migrated from the removed `tests/ReceivablesPage.test.jsx`).
- `tests/Header.test.jsx` and `tests/MobileDrawer.test.jsx` updated for the removal of the "Recebíveis" nav item.
- Verified: 321 frontend tests passing, `npm run build` clean, Prettier `format:check` clean.

## Phase 48 — Frontend documentation and architecture guide (2026-08-14)

### Changed
- Renamed `frontend/docs/refactoring-guide.md` to `frontend/docs/frontend-architecture-guide.md` (English) and turned it into the single frontend structure reference for every change (new feature, improvement, or maintenance).
- The guide now defines a progressive complexity policy (Level 1 single file → Level 2 point extraction → Level 3 page orchestrator), conventions per file type (pages, components, hooks, utils, shared components), and rules for any request (assess before editing, do not push a file past its threshold, extract in the same change, preserve an adequate structure, do not over-split simple files, verify after structural changes), keeping the page-refactoring playbook, anti-patterns, and post-refactoring checks.
- `ARCHITECTURE.md`: repository structure tree and the "page-as-orchestrator" design decision now reference the new guide.
- `AGENTS.md`: updated the current-state phase range to 17-47 and replaced the page-size pitfall with a pointer to `frontend/docs/frontend-architecture-guide.md` as the single frontend structure reference.
- Skills `frontend-react` and `project-structure` now point to the new guide for the complexity policy, per-type conventions, and the refactoring playbook.

### Tests
- Documentation-only change: no test or source-code behavior changed. Verified: Prettier `format:check` clean.

## Phase 47 — Page refactoring to orchestrator architecture (2026-08-14)

### Changed
- Refactored all five main pages into a "page-as-orchestrator" architecture following a new reusable roadmap in `frontend/docs/refactoring-guide.md`: each page folder now holds a custom hook (state, API calls, handlers), local subcomponents, and pure helpers, while the original `*Page.jsx` file becomes a compatibility shim (`export { default } from './{Nome}/index.jsx';`) so existing imports keep working.
- PeoplePage (581 lines): extracted `usePeople.js`, `PeopleTable.jsx`, `PersonModal.jsx`, `PersonForm.jsx`, `PersonFormFields.jsx`, `WhatsappField.jsx`, `SimNaoSelect.jsx`, `BoolBadge.jsx`, and `utils/peopleHelpers.js`.
- OrdersPage (977 lines): extracted `useOrders.js`, `OrdersTable.jsx`, `OrderModal.jsx`, `OrderForm.jsx`, `OrderItemFields.jsx`, `ProductCombobox.jsx`, `Badges.jsx`, and `utils/orderHelpers.js`.
- ProductsPage (923 lines): extracted `useProducts.js`, `ProductsTable.jsx`, `ProductModal.jsx`, `ProductForm.jsx`, `StatusBadge.jsx`, and `utils/productHelpers.js` (including client-side filter/sort helpers).
- ReceivablesPage (971 lines): extracted `useReceivables.js`, `ReceivablesTable.jsx`, `PaymentModal.jsx`, `DetailsModal.jsx`, `StatusBadge.jsx`, and `utils/receivablesHelpers.js`.
- DashboardPage (295 lines → ~90): extracted `useDashboard.js`, `DashboardHeader.jsx`, `KpiCards.jsx`, `BalanceChart.jsx`, `YearlyBreakdown.jsx`, and `utils/dashboardHelpers.js` (BRL formatters, `hasDashboardData`, `buildChartData`).
- Created `frontend/docs/refactoring-guide.md` documenting when to apply the refactor (line count / responsibility-mixing criteria), the step-by-step extraction process, the final folder structure, and anti-patterns to avoid.

### Tests
- All existing page suites (PeoplePage, OrdersPage, ProductsPage, ReceivablesPage, DashboardPage) pass unchanged, preserving every `data-testid`, visible PT-BR text, and event-handler behavior.
- Verified: 321 frontend tests passing, `npm run build` clean, Prettier `format:check` clean.

## Phase 46 — Edit all product fields except code (2026-08-14)

### Changed
- The product edit modal now exposes every editable field: name, size, regular price, member price, PV, URL, and status, all pre-filled from the selected product.
- Submitting the edit sends the three price fields as numbers via `PUT /api/products/:id`; the backend already supported the update and keeps the existing price-history versioning (unchanged prices do not create a new `ProductPrice` record).
- The product code remains immutable: the code field is disabled in the UI and the backend never updates `Product.code`.

### Fixed
- Infinite scroll on the products page stopped working after creating or editing a product: the list refetch set the loading state, which unmounted the scroll sentinel and disconnected the `IntersectionObserver`, but the effect did not re-run because its dependencies were unchanged. The observer effect now depends on `loading` and re-attaches to the new sentinel after a refetch, and the visible count resets to the page size so the updated list starts from the top.

### Tests
- `ProductsPage.test.jsx`: updated the edit-form tests to assert the full `PUT` payload (including prices) and added a price-change test; the pre-fill test now also asserts the price inputs.
- ProductsPage suite: added a regression test that creates a product while infinite scroll is active and asserts the sentinel observer is re-attached (triggering it reveals more rows); the mock `IntersectionObserver` now tracks the observed node and only fires while it remains connected to the DOM.
- Verified: 168 backend + 321 frontend tests passing, `npm run build` clean, Prettier `format:check` clean.


## Phase 45 — Replace window.confirm with ConfirmDialog (2026-08-14)

### Added
- Prettier 3 support (root, `backend/`, `frontend/`): `prettier` pinned as a devDependency in every workspace, root `.prettierrc` (single quotes, semicolons, trailing commas, 80 cols) and `.prettierignore`, and `npm run format` / `npm run format:check` scripts.

### Changed
- Replaced browser-native `window.confirm` prompts with the shared `ConfirmDialog` component on PeoplePage delete, OrdersPage delete, and ProductsPage inline status change, following the ReceivablesPage overpayment-confirmation pattern.
- Each dialog shows a PT-BR title/message, confirm label ("Excluir" for deletes, "Confirmar alteração" for product status), and "Cancelar"; the confirm button shows "Processando..." and Cancel/Esc are disabled while the API call is in flight.
- Success toasts added for delete and status-change operations.

### Tests
- Updated PeoplePage, OrdersPage, and ProductsPage suites to interact with the dialog buttons instead of stubbing `window.confirm`; test renders now wrap pages in `ToastProvider`.
- Verified: 168 backend + 319 frontend tests passing, `npm run build` clean, Prettier `format:check` clean.

## Phases 1-16 — MVP Foundation

### Added
- Docker Compose environment with PostgreSQL 15 and Adminer; one command (`docker compose up --build`) starts all services.
- Prisma schema and migrations for `User`, `Person`, `Order`, `Item`, and `Payment` with cascade rules.
- Express backend with JWT login, `auth` middleware, protected routes, and centralized Zod error handling.
- React SPA with Vite, Tailwind CSS, login page, `AuthContext`, `ProtectedRoute`, and an `AppLayout` using the React Router v6 `<Outlet />` pattern.
- People CRUD with create/edit modals and delete confirmation (PT-BR).
- Orders CRUD with a dynamic multi-row item sub-form and total calculation; nested item add/update/delete recalculates `Order.totalValue`.
- Receivables tracking page with status badges (`Pendente`, `Parcial`, `Quitado`) and per-person payment modal.
- Financial engine: `POST /api/orders/:orderId/payments` creates payments inside a Prisma transaction, validates `amount` against pending balance, and recomputes order status (`PENDENTE` → `PARCIAL` → `QUITADO`); `GET /api/orders/:orderId/balance` returns per-person pending amounts.
- Dashboard with KPI widgets, Recharts bar chart of balances by person, and navigation link.
- Excel export (`xlsx`) producing a four-sheet workbook (`Pedidos`, `Pessoas`, `Histórico de Pagamentos`, `Saldo Pendente`) with BRL-formatted cells and browser download.
- Toast notification system with success/error types and auto-dismiss.
- Vitest + React Testing Library suites established from Phase 5 onward with TDD discipline.

### Fixed
- Floating-point precision regressions in financial comparisons by introducing shared `src/utils/money.js` helpers (`toCents`, `fromCents`, `formatBRL`) and integer-cents arithmetic in backend and frontend.
- `formatBRL` to parse Prisma `Decimal` string values before formatting with `Intl.NumberFormat`.

## Phases 17-25 — Dates, Multi-Tenancy, and UX Foundation

### Added
- Custom `orderDate` (Phase 17) and `paidAt` (Phase 18) fields parsed as local dates via `parseLocalDate()` to avoid UTC day shifts; default to the current timestamp when omitted.
- Dashboard yearly breakdown (Phase 19) grouping pending/quitado totals by `orderDate` year, sorted descending.
- Multi-user registration endpoint `POST /api/auth/register` (Phase 20) with bcrypt hashing and duplicate detection.
- Backend data isolation (Phase 21): `userId` made required on `Person` and `Order` with `ON DELETE CASCADE`; every controller and route scoped by `req.user.userId`; cross-user access blocked.
- Frontend registration UI (Phase 22) with PT-BR form, validation, and login navigation.
- Responsive header (Phase 23) with gradient design, desktop `<NavLink>` highlighting, and mobile bottom navigation using `lucide-react` icons.
- Mobile UX tweaks (Phase 24): `autoCapitalize="none"` on username inputs and `Eye`/`EyeOff` password visibility toggles.
- Dark mode and unified design system (Phase 24): `ThemeContext` with localStorage persistence, `primary` Tailwind tokens, gradient buttons, glassmorphism modals, and dark variants across the app.
- Logged-in user badge (Phase 25) in the header and mobile nav, decoded client-side via `jwt-decode`.
- Docker startup improvements (Phase 25): `npm install` runs on container start in both frontend and backend so anonymous volumes receive new dependencies after rebuild.

### Fixed
- Z-index conflict (Phase 26) between modals and the mobile navigation by raising modal overlays to `z-[60]` and documenting the hierarchy.

## Phase 26 — Onboarding

### Added
- Interactive nine-step onboarding tour triggered on first login after registration, with manual restart via a header `HelpCircle` button and the mobile drawer `Tutorial` item; state persisted in `localStorage` and cross-page navigation during the tour.

## Phases 27-30 — Product Catalog

### Added
- `Product` and `ProductPrice` models (Phase 27) with price history via `validFrom`/`validTo` intervals, `Decimal(10,2)` fields, and a back-reference from `Product` to its items.
- Idempotent CSV diff loader (`npm run load:products`) supporting `--date YYYY-MM-DD` retroactive validity and `--dry-run` preview; loader tests snapshot and restore the real catalog so the suite never disables real products.
- Product CRUD API at `/api/products` (Phase 28) with immutable `code`, price-history-preserving updates, and soft-delete.
- `ProductsPage` UI with create/edit modals, status badges, and deactivation actions.
- Mobile drawer navigation (`MobileDrawer.jsx`) replacing the fixed bottom nav, plus a `Produtos` link in the desktop header; onboarding tour extended to nine steps.
- Product search, sorting, and infinite scroll (Phase 29) via `q`, `sortBy`/`sortDir`, and `page`/`pageSize` returning `{ data, pagination }`.
- Client-side load-once catalog (Phase 30): `pageSize=all` returns the full list; the page fetches once and applies search, status filter, and sorting in-memory with `useMemo`; infinite scroll slices the in-memory list.

### Changed
- `GET /api/products` response shape from a bare array to `{ data, pagination }`.

## Phases 31-35 — Order and Payment Rules

### Added
- Product-linked order items (Phase 31) via a `ProductCombobox` that auto-fills read-only member-price and PV snapshots; editable `chargedValue` and free-text `details` (≤500 chars); `Item.value` renamed to `chargedValue`, `description` became optional, and a `productId` FK with `ON DELETE SET NULL` was added.
- Order descriptive fields (Phase 32): dōTERRA order number placeholder, "Ver pedido no site" tracking link shown on blur, `accountOwner` (≤120), `PaymentType` enum (`PIX`/`BOLETO`/`CARTAO_CREDITO`), `orderNotes` (≤500 with live counter), and live product/PV summary cards above the items; orders list gained Responsável, Tipo Pgto, PV Total, Descrição, and Rastreio columns.
- Zero-value gift `chargedValue` (Phase 33): empty input treated as `0`; backend `itemSchema.chargedValue` uses `min(0).default(0)`; negatives still rejected.
- "Dar baixa" for zero-value persons and overpayment acceptance (Phase 34): backend `paymentSchema.amount` changed to `nonnegative()`, overpayment rejection removed, zero accepted only when `itemSum === 0`, and frontend validation aligned.
- Custom `ConfirmDialog` component (Phase 35) replacing `window.confirm` for overpayment confirmation, with `z-[70]` overlay, PT-BR copy, gradient confirm button, and Escape/backdrop cancellation.

### Changed
- `Payment.amount` validation from `positive()` to `nonnegative()`.
- All financial sums (`Order.totalValue`, payments, dashboard) to read `chargedValue` instead of `value`.

## Phases 36-38 — Client and Receivables Detail

### Added
- Client registration enrichment (Phase 36): `commonGroups`, `whatsapp` (renamed from `contact`, digits-only storage with progressive mask, `wa.me` link, out-of-pattern warning), `instagram`, `address`, `isVip`, and `isDoterraMember`; menu label "Pessoas" → "Clientes"; Excel "Pessoas" sheet renamed to "Clientes" with the new columns.
- Receivables table parity with orders (Phase 37): nine columns including client-side Valor Pendente (`max(0, totalValue − payments)`) and PV Total; shared `formatDateBR` extracted to `frontend/src/utils/dates.js`.
- Payment modal enrichment (Phase 38): always-visible order summary header (Número, Data, Responsável, Valor Total, Valor Pendente, Descrição) and a per-person items list; modal widened with scroll.

### Changed
- `Person.contact` renamed to `Person.whatsapp` via a hand-edited `RENAME COLUMN` migration to preserve data.

## Phases 39-44 — Catalog Statuses, Responsive Lists, and Actions

### Added
- `ProductStatus` enum (Phase 39) replacing the `active` boolean: `ATIVO`, `INDISPONIVEL`, `INATIVO`; nullable `doterraUrl`; three-state filter/badges; "Site" link column; inline status dropdown; orders accept `ATIVO`/`INDISPONIVEL` and reject `INATIVO`; combobox shows `INATIVO` product names on edit via a fallback.
- Flowbite `data-label` responsive cards (Phase 40) for all five tables (Clientes, Pedidos, Recebíveis, Produtos, Dashboard "Resumo por Ano"), eliminating horizontal scrollbars below `md` while keeping semantic table markup and all columns visible.
- Reusable `ActionMenu` kebab component (Phase 41) for the Orders `Ações` column with `default`/`danger` variants, `z-[80]` panel, backdrop/Escape close, and deterministic `data-testid`s; migration playbook added at `docs/ACTION_MENU_REFACTORING_GUIDE.md`.
- Kebab menus (Phase 42) on Clientes (Editar + Excluir) and Produtos (Editar); inline status `<select>` on Produtos preserved alongside the kebab.
- Conditional receivables actions (Phase 43): kebab-only column with primary "Registrar Pagamento" or "Dar baixa" plus "Detalhar" for all orders; muted Valor Pendente when zero.
- Receivables detail modal (Phase 44): order summary header, per-person totals from `/balance`, exclusive accordion with items and received payments, loading/empty states, and responsive dark-mode layout.

### Changed
- Catalog loader deactivation logic to only deactivate `ATIVO` products absent from the CSV, preserving manual `INDISPONIVEL`.

### Removed
- Inline "Editar"/"Excluir" text buttons from table action columns, replaced by the `ActionMenu` kebab.

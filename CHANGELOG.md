# Changelog

All notable changes to the Receivables Control System are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Guidance for maintainers:

- This changelog does **not** keep a running `## [Unreleased]` section. When the user signals more adjustments may follow, the agent records what was just done in `NOTES.md` instead of editing `CHANGELOG.md`. When the user signals that no more adjustments are pending, those notes are consolidated into a new dated `## Phase N` section (most recent at the top) and grouped under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` as applicable. The agent then clears the entries from `NOTES.md`. See the **New Feature Workflow** in `AGENTS.md` for the full protocol.
- Keep each entry concise and actionable; refer to `AGENTS.md` for rules and `ARCHITECTURE.md` for system structure.
- Monetary amounts are in Brazilian Real (BRL) unless stated otherwise.

## Phase 111 — Correção da duplicação ao escolher depósito de origem no resgate InfinitePay (2026-09-21)

### Fixed
- **Totalização duplicada ao clicar em "Depósitos de origem"**: depois de o resgate já estar atribuído a uma venda inteira ("Vendas sugeridas pelo valor", sem `sourceKey`), clicar na venda casada de um depósito de origem **somava** o valor do depósito por cima em vez de redefinir a atribuição. Um resgate de R$ 220,01 com a V-0018 previamente selecionada passava a exibir "Selecionado: R$ 440,02 de R$ 220,01", crescendo a cada clique (660,03, 880,04…). O `assignFromDeposit` em `frontend/src/pages/Sales/useInfinitePayRescueImport.js` agora remove a atribuição do resgate inteiro antes de adicionar a do depósito (novo helper `replaceWholeRescueAssignment` em `frontend/src/pages/Sales/utils/infinitepayRescueHelpers.js`), então a escolha do depósito **redefine** a atribuição. O `mergeAssignments` deixou de mutar os objetos no state (passou a copiar antes de somar).

### Changed
- **E2E configurável por URL**: `frontend/e2e/helpers.js` e `frontend/playwright.config.js` passaram a derivar a base da API de `E2E_API_URL`/`E2E_BASE_URL` (padrão `http://localhost:3000`, o stack de produção que serve SPA + API juntos), com os specs `team-orders`, `team-order-client` e `order-entry-modes` usando `API_URL` em vez de `localhost:4000` fixo.

### Tests
- Frontend: `useInfinitePayRescueImport.test.js` ganhou 2 casos (redefine em vez de empilhar quando o depósito casa com a venda já atribuída ao resgate inteiro; e ausência de mutação do state no merge). Novo e2e `frontend/e2e/infinitepay-rescue-import.spec.js` (CT1 cobre a não-duplicação do total; CT2 cobre o desfazer da importação em lote). Verificação: **1023 frontend** passando, e2e 2/2 no stack de produção, `npm run lint` sem erros, `npm run build` e `npm run format:check` limpos. O e2e foi validado contra a falha (sem a correção exibe "R$ 440,02 de R$ 220,01"; com a correção passa).

## Phase 111 — Stack Docker de produção usa a base da aplicação (2026-09-21)

### Fixed
- **`docker-compose.prod.yml` apontava para a base de testes**: o serviço `backend` fixava `DATABASE_URL` em `receivables` (base usada pela suíte de testes), então a aplicação em produção subia sem os dados reais. O stack de produção passou a reutilizar `backend/.env` — mesma base `receivables_cliente` e mesmos segredos do ambiente de desenvolvimento — sobrescrevendo apenas `PORT`, `NODE_ENV`, `SERVE_STATIC` e `STATIC_DIR`. Container recriado e validado em `http://localhost:3000` com os dados reais (`receivables_cliente`: 6 usuários, 64 clientes, 67 pedidos).

## Phase 110 — Modo produção (SPA + API no mesmo processo na porta 3000) (2026-09-21)

### Added
- **Frontend buildado servido pelo backend**: em produção o próprio processo Node serve a SPA e a API na **mesma origem** (`http://localhost:3000`), sem CORS nem proxy. O helper `backend/src/utils/serveFrontend.js` (`registerFrontend(app, staticDir)`) monta o `express.static` e o fallback de SPA (rotas do React Router caem em `index.html`), deixando `/api` intacto e retornando `false` quando não há `dist/`. Ativado por `SERVE_STATIC=true` (ou `NODE_ENV=production`); `STATIC_DIR` é configurável e por padrão aponta para `frontend/dist`.
- **`start-prod.bat` (Windows, cliente)**: verifica Node/git/PostgreSQL, instala dependências faltantes, aplica `prisma migrate deploy`, **builda o frontend somente quando necessário** (quando `frontend\dist` não existe, quando o commit atual difere do último build gravado em `frontend\dist\.build-commit`, ou quando há mudanças não commitadas em `frontend/`) e sobe o backend em modo produção na porta 3000.
- **Stack Docker de produção**: `backend/Dockerfile.prod` (estágio que builda o SPA e copia `dist/` para a imagem do backend), `backend/entrypoint.prod.sh`, `docker-compose.prod.yml` (backend serve SPA + API na 3000, volume persistente `receivables_uploads` para anexos e `postgres_data` compartilhado com o stack dev) e `.dockerignore` na raiz.
- **Script `npm start`** na raiz (`npm --prefix backend start`).

### Changed
- **`backend/src/config.js`**: novos exports `SERVE_STATIC` e `STATIC_DIR`.
- **`backend/src/app.js`**: monta a SPA após as rotas de API quando `SERVE_STATIC` está ativo.
- **`update.bat`**: grava `frontend\dist\.build-commit` após o build, para o `start-prod.bat` não rebuildar à toa depois de uma atualização.
- **`start.bat` / `start-prod.bat`**: a checagem do Prisma Client passou a usar o caminho real `backend\node_modules\.prisma\client` (antes checava `backend\prisma\generated`, que nunca existe, forçando `prisma generate` em toda execução).
- **Docs**: `ARCHITECTURE.md` (endereço de produção, `SERVE_STATIC`/`STATIC_DIR`, árvore de arquivos, Docker de produção), `DEPLOYMENT.md` (passos 7–9 no modelo de produção e checklist) e `AGENTS.md` (portas/stack de produção e comandos).

### Fixed
- **`update.bat` abortava de forma abrupta (`... foi inesperado neste momento.`) logo após o `git pull`**: os `echo` de `Instalando dependencias (npm ci)...` e `Aplicando (migrate deploy)...` estavam **dentro de blocos `if (...)`**, e o `)` do parêntese fechava o bloco antes da hora, quebrando o passo 6. Os parênteses foram removidos (mesma classe de bug já corrigida no `start.bat`).

### Tests
- Backend: `backend/tests/serveFrontend.test.js` (7) cobre `index.html` na raiz, assets estáticos, fallback de SPA, rotas de API preservadas, `404` para `/api` desconhecida e ausência de `dist`. **849 backend + 1021 frontend passing**; `npm run lint` sem erros (6 warnings preexistentes), `npm run build` e `npm run format:check` limpos. A imagem Docker de produção foi construída e validada por smoke test (SPA na raiz, fallback de rota e `/health`).

## Phase 109 — Tela inicial volta a ser Produtos (2026-09-21)

### Fixed
- **Tela inicial padrão**: a rota raiz (`/`) e a rota coringa (`*`) voltaram a redirecionar para `/products` em vez de `/finances`, restaurando **Produtos** como a primeira tela carregada ao abrir a aplicação (`frontend/src/App.jsx`).

### Tests
- Frontend: `App.test.jsx` passou a afirmar que `/` e caminhos desconhecidos caem na tela de Produtos (e não na de Finanças). **1021 frontend passing**; `npm run build` e `npm run format:check` limpos. Backend sem alterações.

## Phase 108 — Importação de resgates InfinitePay pelo extrato bancário (2026-09-20)

### Added
- **Importação de resgates InfinitePay a partir do extrato bancário**: novo botão **"Importar resgates"** na tela de Vendas lê o extrato da conta (CSV de 6 colunas `Data,Hora,Tipo de transação,Nome,Detalhe,Valor`) e apresenta cada **Pix Enviado** (o resgate de fato) pareado com os **Depósito de vendas** contíguos cuja soma bate com o valor resgatado (tolerância de **até 2 centavos**). Cada resgate pode ser de **uma venda ou de n vendas**: o sistema sugere as vendas por valor (líquido/valor do pagamento InfinitePay, total, pendente ou saldo ainda resgatável) e o usuário confirma; quando mais de uma venda casa, ele escolhe a correta; quando nenhuma casa pelo valor, ele seleciona manualmente uma ou mais vendas, com **totalizador** que só libera a confirmação quando a soma fecha. O preview (`POST /api/sales/infinitepay-rescues/import`) não persiste nada; a confirmação (`POST /api/sales/infinitepay-rescues/commit`) cria os lançamentos `RESGATE_INFINITEPAY` reutilizando as regras do resgate manual (venda própria, tipo `VENDA`, não-equipe, com pagamento `INFINITE_PAY`), numa única `$transaction`, e aborta o lote inteiro se houver resgate duplicado (mesma venda/data/valor). Parsers/serviços novos: `backend/src/utils/bankStatementParser.js` (reusa o leitor RFC 4180 de `csvParser.js`, agora exportado) e `backend/src/services/infinitepayRescueService.js`; matcher puro em `backend/src/utils/rescueHelpers.js`.
- **Desfazer o resgate**: cada resgate pode ser desfeito depois, caso a identificação tenha sido incorreta. Na tabela de Finanças, as linhas `RESGATE_INFINITEPAY` ganharam a ação **"Desfazer resgate"** (com diálogo de confirmação) via `DELETE /api/finances/settlements/:id`; a importação inteira é marcada com um **lote** (`importBatchId` em `FinancialTransaction`, migração `20260920140000_add_settlement_import_batch`) e pode ser desfeita de uma vez pelo banner de sucesso do modal (`DELETE /api/finances/settlements/batch/:batchId`, idempotente). Desfazer remove apenas o lançamento do financeiro — o pagamento da venda e seu status ficam intactos.
- **`backend/src/validators/rescueValidator.js`**: schemas do preview e do commit (todas as parcelas em centavos inteiros).

### Changed
- **`financeTransactionsService.js`**: `assertSettleableOrder` e `buildSettlementData` extraídos de `createSettlement`, agora compartilhados com a importação; novos `deleteRescue` e `deleteRescueBatch`.
- **`csvParser.js`**: `parseCsvRecords` exportado para reuso pelo parser do extrato bancário.
- **Frontend**: header da tela de Vendas extraído para `SalesToolbar.jsx`; o fluxo de resgates é autocontido em `components/InfinitePayRescueImport.jsx` (input oculto + hook + modal), com `useInfinitePayRescueImport.js`, `components/InfinitePayRescueImportModal.jsx`, `components/InfinitePayRescueRow.jsx` e `utils/infinitepayRescueHelpers.js`. `useFinances`/`FinancesTable`/`Finances/index.jsx` ganharam a ação "Desfazer resgate". Badges de match/balance adicionados em `utils/badgeStyles.js`.
- **`ARCHITECTURE.md`**: modelo do `importBatchId`, novas rotas de `/api/sales` e `/api/finances`, feature de importação de resgates e árvore de arquivos atualizadas.

### Tests
- Backend: `bankStatementParser.test.js` (15), `rescueHelpers.test.js` (12) e `infinitepayRescueImport.test.js` (16, cobre preview sem persistir, pareamento de depósitos, commit de um e de vários resgates, soma divergente, venda de outro usuário/sem InfinitePay, duplicidade, undo por linha e por lote, e isolamento por usuário). Frontend: `infinitepayRescueHelpers.test.js` (8), `useInfinitePayRescueImport.test.js` (12), `InfinitePayRescueImportModal.test.jsx` (7) e `FinancesRescueUndo.test.jsx` (3). **842 backend + 1021 frontend passing**; `npm run lint` sem erros, `npm run build`, `npm run format:check` e `node scripts/contrast-check.mjs` (AA) limpos.

## Phase 107 — Correção do cleanup de produtos de teste no `productLoader.test.js` (2026-09-20)

### Fixed
- **13 falhas da suíte backend em `productLoader.test.js`**: a limpeza usava `prisma.product.deleteMany({ where: { code: { startsWith: 'TEST' } } })`, um `deleteMany` atômico e amplo. Como `Inventory`, `StockMovement` e `KitComposition` referenciam `Product` com `ON DELETE RESTRICT`, **uma única linha órfã** deixada por outra suíte (ou por uma execução interrompida) abortava o `deleteMany` inteiro com `Foreign key constraint violated: Inventory_productId_fkey`. Os produtos `TEST0001/2/3` nunca eram removidos, então cada `loadProductCatalog` empilhava um novo `ProductPrice` e as asserções `toHaveLength` viravam 93/96/99 itens. A origem concreta foi o produto `TESTSALE7524` + 2 linhas de `Inventory` deixados por uma execução interrompida de `sales.test.js` em 2026-09-20 ~12:14 (local). A suíte voltou a **799/799 passing**.

### Changed
- **`backend/tests/productLoader.test.js`**: novo helper `removeTestProducts()` que apaga os dependentes (`KitComposition`, `Inventory`, `StockMovement`) antes dos produtos, e é chamado no `beforeEach` e no `afterEach`. O cleanup deixou de ser bloqueável por FKs `Restrict`.
- **`AGENTS.md`**: o pitfall de cleanup de produtos de teste foi generalizado — antes só citava `KitComposition`; agora cobre também `Inventory`/`StockMovement`, o efeito do `deleteMany` amplo e a poluição cruzada entre suítes.

### Notes
- A base da suíte de testes (`receivables`) é separada da base da aplicação (`receivables_cliente`), ambas no mesmo Postgres. Nenhum dado de teste é visível na tela nem afeta pedidos/vendas reais.

## Phase 106 — Correção de pagamento InfinitePay existente pela importação (2026-09-20)

### Added
- **Edição pré-preenchida do pagamento InfinitePay existente**: quando a venda sugerida pela importação do extrato **já possui um pagamento `INFINITE_PAY`**, o botão "Usar esta venda" passa a abrir o **formulário de edição** desse pagamento (o mais recente, por `createdAt`) em vez do formulário de criação. O formulário vem preenchido com os dados da linha do extrato — valor cobrado (`valor`), líquido (`líquido`), data e **NSU anexado às notas já existentes** (`<notas> · InfinitePay · NSU <nsu>`) — permitindo corrigir a cobrança já lançada (caso em que o valor pendente é justamente a diferença da taxa) sem gerar um segundo pagamento e sem cair no aviso de sobrepagamento. Sem pagamento InfinitePay na venda, o comportamento anterior (criação pré-preenchida) é mantido. Novo helper `buildEditPaymentPrefill` em `frontend/src/pages/Sales/utils/infinitepayHelpers.js` e `openEditPaymentModalPrefilled` em `frontend/src/pages/Sales/useSalePayments.js`; o roteamento entre criação e edição fica em `frontend/src/pages/Sales/useInfinitePayImport.js` e a fiação em `frontend/src/pages/Sales/index.jsx`. Após salvar, a linha é marcada como **"Usada"** e o modal de importação reabre; cancelar mantém a linha disponível.
- **Sem efeito no fluxo de caixa**: editar um pagamento `INFINITE_PAY` continua sendo no-op para o ledger (`shouldSyncIncome` exclui InfinitePay), então lançamentos `RESGATE_INFINITEPAY` existentes permanecem intactos e o resgate segue manual. O efeito observável da correção é apenas o status da venda (`PENDENTE` → `QUITADO` quando a taxa é reconhecida).

### Tests
- Frontend: `infinitepayHelpers.test.js` ganhou 4 casos de `buildEditPaymentPrefill` (valores derivados do extrato, repasse da taxa conforme o match, NSU anexado às notas existentes e nota isolada quando não há notas); `useInfinitePayImport.test.js` ganhou 4 casos (roteia para edição quando há pagamento InfinitePay, mantém a criação sem ele, escolhe o pagamento mais recente e marca a linha como usada no `onDone`); integração em `SalesPage.test.jsx` cobre o fluxo importação → edição pré-preenchida. **991 frontend passing**; `npm run lint` sem erros (6 warnings preexistentes), `npm run build` e `npm run format:check` limpos. Backend sem alterações (13 falhas pré-existentes em `productLoader.test.js`).

## Phase 105 — Importação do extrato InfinitePay e baixa de vendas por valor (2026-09-20)

### Added
- **Importação do extrato CSV do InfinitePay (`POST /api/sales/infinitepay/import`)**: novo botão **"Importar InfinitePay"** na tela de Vendas abre um modal que lista os lançamentos aprovados do extrato (data, valor, líquido, taxa e `Origem - Nome`) e sugere, para cada linha, as vendas cujo total é igual ao **valor** ou ao **líquido** com tolerância de **até 2 centavos**. O parser (`parseInfinitePayCsv` em `backend/src/utils/csvParser.js`) é uma função pura sem dependências que valida o cabeçalho fixo de 15 colunas, converte os valores no formato brasileiro (`234,02`, `'- 14,01`) para centavos e valida a data `DD/MM/AAAA HH:MM`; qualquer linha fora do padrão rejeita o arquivo inteiro com `400` e o número da linha. Registros com status **Negada** são descartados e contados (`ignoredCount`). O cruzamento é feito por `backend/src/utils/infinitepayHelpers.js` (`matchRowToSales`), restrito às vendas do próprio usuário (`VENDA`, não-equipe, com pendência). Upload em memória via `middlewares/upload.js` (`INFINITEPAY_MAX_BYTES`, padrão 2 MB).
- **Baixa pré-preenchida a partir do extrato**: ao escolher uma venda sugerida, o modal de pagamento abre preenchido com forma **InfinitePay**, valor cobrado = `valor`, valor líquido = `líquido`, data do extrato e nota com o NSU; a flag **"Repassar taxa do InfinitePay ao cliente"** é marcada automaticamente quando a venda casou pelo **líquido** (cliente pagou a taxa) e desmarcada quando casou pelo **valor**. Após registrar, a linha é marcada como **"Usada"** e o modal de importação reabre; cancelar mantém a linha disponível. Componentes: `frontend/src/pages/Sales/useInfinitePayImport.js`, `frontend/src/pages/Sales/components/InfinitePayImportModal.jsx` e `frontend/src/pages/Sales/utils/infinitepayHelpers.js`, com `openPaymentModalPrefilled` em `useSalePayments.js`.

### Tests
- Backend: `infinitepayCsvParser.test.js` (16), `infinitepayHelpers.test.js` (12) e `salesInfinitepayImport.test.js` (10, cobre isolamento por usuário, `QUITADO`/equipe fora dos matches, tolerância de 2 centavos e rejeição de cabeçalho, linha e tipo de arquivo). Frontend: `infinitepayHelpers.test.js` (8), `useInfinitePayImport.test.js` (8), `InfinitePayImportModal.test.jsx` (8) e integração em `SalesPage.test.jsx`. Suíte backend: 786 passando de 799 (as 13 falhas em `productLoader.test.js` são pré-existentes, confirmadas no baseline, por poluição do banco de testes compartilhado); **982 frontend** passando; `npm run lint` sem erros (apenas warnings pré-existentes), `npm run build` e `npm run format:check` limpos.

## Phase 104 — Cashback e modo de cobrança absorvidos pela % de promoção nos pedidos (2026-09-20)

### Changed
- **Campo `% Promoção` no formulário detalhado de pedidos**: o modo Formulário detalhado passou a ter o mesmo campo de promoção já existente no modo Planilha (`frontend/src/pages/Orders/components/OrderItemFields.jsx`, `order-item-discount-<i>`), deixando os dois modos compatíveis. Digitar a porcentagem recalcula o **Valor Pago** a partir do preço de membro (`prefilledChargedValue`), e a edição manual do valor é preservada até o produto ou a promoção mudarem — mesmo comportamento da planilha (`frontend/src/pages/Orders/useOrders.js`, `utils/orderHelpers.js`).
- **Pedidos antigos com cashback são exibidos como 70% de promoção**: novo helper `reconstructDiscountPercent` (`frontend/src/pages/Orders/utils/orderHelpers.js`) reconstrói a `% Promoção` de um item persistido — itens `UNIT` derivam a porcentagem de `chargedValue`/`memberPrice` e itens legados com `useCashback` viram 70%. O `chargedValue` salvo é mantido, então o valor cobrado não muda; a mesma conversão é usada ao hidratar as linhas da planilha (`utils/orderSpreadsheetHelpers.js`).
- **`useOrders`**: `onCashbackToggle` removido; `updateItemField` passou a recalcular `chargedValue` ao mudar `discountPercent`, e `updateSpreadsheetRow` deixou de tratar `useCashback`.
- **`ARCHITECTURE.md`**: atualizada a seção dos modos de inclusão de pedido (paridade de campos, `% Promoção` nos dois modos, conversão de cashback legado e remoção do select de modo).

### Removed
- **Campo de cashback dos pedidos**: removido o checkbox "Usei pontos de cashback e ganhei 70% de desconto" do Formulário detalhado e da Planilha (coluna/coluna do cabeçalho incluídas), e o frontend não envia mais `useCashback` no payload (`itemPayload`). O backend mantém a coluna `Item.useCashback` para dados históricos, sem migração.
- **Select "Preço por unidade / Valor total da linha"**: removido dos dois modos; novos itens são sempre `UNIT` (`chargedValueMode`). Itens legados em `TOTAL` continuam com o valor e o cálculo corretos, apenas sem troca de modo pela tela.

### Tests
- Frontend: atualizados `frontend/tests/OrdersPage.test.jsx` (cashback → promoção, remoção do select de modo, item legado `TOTAL` preservado, ausência de `useCashback` no payload), `OrdersSpreadsheet.test.jsx` (promoção no lugar de cashback, remoção dos testes de modo) e `orderSpreadsheetHelpers.test.js` (conversão de cashback legado em 70%, remoção das expectativas de `useCashback`); e2e `frontend/e2e/order-entry-modes.spec.js` atualizado para os novos campos. **957 frontend passing**; `npm run build` e `npm run format:check` limpos e `npm run lint` sem erros (6 warnings preexistentes). Backend sem alterações (13 falhas pré-existentes em `productLoader.test.js`).

## Phase 103 — Modo de inclusão de pedidos (Formulário detalhado / Planilha) e deep-link de detalhes pelo financeiro (2026-09-20)

### Added
- **Modo de inclusão Planilha na criação/edição de pedidos**: o modal de Novo/Editar Pedido ganhou a escolha **Modo de inclusão** em radio buttons — **Formulário detalhado** (padrão, comportamento atual preservado) e **Planilha**. O modo Planilha usa uma tabela no formato do simulador, porém gravável, cobrindo **todos os campos do item do formulário detalhado**: Produto, Qtd, % Promo, **Valor Pago** (editável, com modo **Por unidade** / **Valor total**), **V. Pago total**, **Cashback**, V. Membro unit./total, PV total, **Estoque** (checkbox; para KIT revela "Estocar o kit"/"Estocar componentes") e **Detalhes**. O Valor Pago é pré-preenchido a partir do preço membro após a promoção (×30% quando há cashback) e pode ser sobrescrito; pedidos da equipe continuam sem controle de estoque. A preferência é gravada em `localStorage` (`oc-order-entry-mode`, padrão `detailed`) por `frontend/src/pages/Orders/useOrderEntryMode.js`; ao trocar de modo o app pergunta se a escolha deve virar padrão ("Manter como padrão" / "Só desta vez").
- **Conversão planilha ↔ item e hidratação na edição**: novo `frontend/src/pages/Orders/utils/orderSpreadsheetHelpers.js` converte linhas em itens (e vice-versa) reutilizando preço, modo, cashback, estoque e detalhes. Ao editar um pedido os itens são hidratados nos dois modos, e o payload enviado a `/api/orders` permanece idêntico ao do formulário detalhado. Trocar de modo com itens não salvos pede confirmação e descarta as alterações de itens do modo de origem; os campos de pedido (número, data, conta, cliente da equipe, frete etc.) são compartilhados e preservados.
- **Deep-link de detalhes a partir do financeiro**: no fluxo de caixa, clicar no link de uma venda/pedido abre o respectivo modal de detalhes em vez de redirecionar para a raiz — vendas (`VENDA`, `RESGATE_INFINITEPAY`, `VENDA_ADICIONAL`) via `/sales?detailsSale=<id>` e pedidos dōTERRA via `/orders?detailsOrder=<id>`. O link "produtos comprados" nos detalhes do cliente passou a abrir os detalhes da venda (`/sales?detailsSale=<id>`), em vez do formulário de edição.

### Changed
- **`useOrders`/`OrderForm`**: `useOrders` concentra `entryMode`, o estado das linhas da planilha e a validação/build do payload conforme o modo ativo; os campos de pedido foram extraídos para `frontend/src/pages/Orders/components/OrderDetailsFields.jsx`, reutilizados pelos dois modos; `frontend/src/pages/Orders/index.jsx` renderiza `OrderForm` ou `OrderSpreadsheetForm` e os diálogos de confirmação (perda de dados ao trocar de modo e manutenção do modo como padrão). No modo Planilha o modal alarga para `max-w-[95vw]`. Novos componentes `OrderSpreadsheetForm.jsx`, `OrderSpreadsheetRow.jsx` e `OrderEntryModeSelector.jsx`.
- **`useSalePayments`/Vendas**: o hook passou a receber `sales`/`loading` e a suportar `?detailsSale=<id>`, espelhando o `?detailsOrder=` já existente; `Sales/index.jsx` passa as novas props.
- **`ARCHITECTURE.md`**: documentados os dois modos de inclusão de pedido (radio buttons, preferência em `localStorage`, helpers de conversão e paridade de campos) e o deep-link de detalhes a partir do financeiro.

### Tests
- Frontend: novos `frontend/tests/orderSpreadsheetHelpers.test.js` (36), `frontend/tests/useOrderEntryMode.test.jsx` (8) e `frontend/tests/OrdersSpreadsheet.test.jsx` (22: seleção de modo e padrão, aviso de perda de dados, campos da planilha, cashback, estoque/KIT, criação e edição); novo e2e `frontend/e2e/order-entry-modes.spec.js` (3: paridade de campos entre os modos, criação pelo modo Planilha e edição com hidratação). Atualizados `SalesPayments.test.jsx` (deep-link `?detailsSale`), `FinancesPage.test.jsx` (asserções de `href`) e `PeoplePage.test.jsx` (link da venda). **959 frontend passing + 3 e2e**; `npm run build` e `npm run format:check` limpos e ESLint 0 erros (6 warnings preexistentes). Backend sem alterações.

## Phase 102 — Foto anexa na venda e ajustes de valores adicionais/recebido (2026-09-20)

### Added
- **Foto anexa na venda (`VENDA`)**: cada venda passa a aceitar **uma foto opcional** (PNG/JPEG/WebP, máx. 10 MB), reutilizando o campo já existente `Order.attachmentFilename` e todo o pipeline de anexos dos pedidos (disco em `backend/uploads/orders/`, nome UUID gerado no servidor, validação por `ATTACHMENT_MAX_BYTES`). O controlador de anexos (`orderAttachmentsController.js`, antes restrito a `COMPRA`) foi generalizado/parametrizado e passou a ser montado também em `/api/sales/:id/attachment` (`POST`/`GET`/`DELETE`), com o wrapper `uploadSingleAttachment` extraído para `middlewares/upload.js` e compartilhado pelos dois roteadores. A exclusão da venda (`DELETE /api/sales/:id`) agora remove também o arquivo do anexo. No frontend, o formulário de venda ganhou o campo **Foto da Venda** (com prévia e opção de remover a foto existente ao editar) e a lista de vendas ganhou a coluna **Anexo**, que mostra uma miniatura clicável (carregada sob demanda ao entrar na viewport) e abre o preview em modal; o `AttachmentPreviewModal` foi promovido de `pages/Orders/components/` para `frontend/src/components/` (compartilhado pelas telas de Pedidos e Vendas) e agora alterna compacto/expandido **ao clicar na própria imagem** (o botão Expandir/Reduzir continua disponível para teclado).
- **Despesa automática a partir de "Valores Adicionais" na venda**: ao salvar uma venda com **Valores Adicionais > 0**, o formulário revela os campos obrigatórios **Categoria da despesa** (somente categorias `DESPESA` ativas) e **Descrição da despesa**, e o backend cria/atualiza uma despesa automática vinculada à venda (nova origem `VENDA_ADICIONAL`, migração `20260920120000_add_sale_additional_expense_origin`); a despesa é removida quando o valor adicional é zerado ou a venda é excluída (cascade). A categoria/descrição são revalidadas a cada salvamento; a categoria precisa pertencer ao usuário e ser do tipo `DESPESA`. Os endpoints de leitura de vendas expõem `additionalExpenseCategoryId`/`additionalExpenseDescription` para preencher o formulário de edição.
- **"Valores Adicionais" absorvidos pelo vendedor (não cobrados do cliente)**: novo campo `Order.additionalValueChargedToClient` (Boolean, default `true`, migração `20260920130000_add_additional_value_charged_flag`). Os Valores Adicionais continuam gerando a despesa `VENDA_ADICIONAL` no financeiro, mas quando a flag é `false` o valor sai do `totalValue`, do saldo pendente e da regra de `QUITADO`; a troca da flag a qualquer momento recalcula total e status nos dois sentidos.

### Changed
- **Coluna "Recebido" e detalhamento exibem o líquido recebido**: quando o vendedor repassa a taxa do InfinitePay ao cliente (cobra, por ex., R$ 349,72 para receber R$ 335,03 líquidos), a coluna **Recebido** da lista de vendas e o **Detalhamento de Pagamentos** passam a exibir o valor **líquido recebido** (`Payment.netAmount`), caindo no valor cobrado quando não há líquido informado. O status continua `QUITADO` (a regra de status/pendente segue usando o valor cobrado).
- **`ARCHITECTURE.md`**: `Order.attachmentFilename` documentado como compartilhado por `COMPRA` (screenshot dōTERRA) e `VENDA` (foto da venda); novas rotas `/api/sales/:id/attachment` e limpeza do anexo na exclusão da venda; coluna **Anexo** e campo **Foto da Venda** descritos na UI de Vendas; `AttachmentPreviewModal` promovido a componente compartilhado.

### Fixed
- **Anexo de venda na lista**: a miniatura usa o mesmo endpoint autenticado do modal (blob com JWT), então a imagem nunca é exposta por caminho estático; o carregamento é adiado até a linha entrar na viewport para não disparar uma requisição por venda visível.

### Tests
- Backend: novo `backend/tests/salesAttachments.test.js` (9 casos: upload/substituição, tipo inválido, tamanho, isolamento por usuário, `GET`/`DELETE`, limpeza do arquivo na exclusão da venda, não autenticado); `ordersAttachments.test.js` mantido (14). **748 backend passing** (13 falhas pré-existentes em `productLoader.test.js`, confirmadas antes da mudança e reproduzidas isoladamente).
- Frontend: `frontend/tests/SalesPage.test.jsx` ganhou 9 casos (miniatura presente/ausente, abertura do preview pela miniatura, alternância de tamanho ao clicar na imagem, input no criar, upload no criar, foto existente + remover, exclusão no editar e upload de nova foto no editar). **891 frontend passing**; `npm run build` e `npm run format:check` limpos e `npm run lint` sem erros (5 warnings preexistentes no frontend).

## Phase 101 — Aviso único do novo módulo de Finanças (2026-09-19)

### Added
- **Aviso de novo módulo de Finanças**: novo componente `frontend/src/components/FinancesAnnouncement.jsx`, montado no `AppLayout` (`frontend/src/App.jsx`) ao lado do `OnboardingTour`, usa o `Modal` compartilhado para exibir **uma única vez**, ao abrir a aplicação, um resumo das funcionalidades do módulo (lançamentos de receitas/despesas, resumo de receitas/despesas/saldo, filtros por período/tipo/origem/categoria, categorias personalizáveis e baixa de vendas por gateway). O estado "já visto" é gravado **por usuário** em `localStorage` (`finances_announcement_seen_<userId>`, via `useAuth().user.id`), então cada usuário vê o aviso uma vez por navegador; fechar por qualquer via (botão "Entendi", `×`, Escape ou clique no backdrop) marca como visto e não o exibe novamente.

### Tests
- Frontend: novo `frontend/tests/FinancesAnnouncement.test.jsx` (8: exibição na primeira abertura, ocultação após visto, lista de destaques, marcação por usuário, fechamento pelo botão e pelo `Modal` compartilhado, permanência após remontar e ausência sem usuário autenticado); `App.test.jsx` mocka o novo componente. **873 frontend passing**; `npm run build` e `npm run format:check` limpos e `npm run lint` sem erros (5 warnings preexistentes). Backend sem alterações.

## Phase 100 — Módulo Financeiro: backfill de lançamentos e regra de pedido compartilhado (2026-09-19)

### Added
- **Backfill de lançamentos financeiros (`backend/scripts/backfillFinancialTransactions.js`)**: script de manutenção idempotente (com `--dry-run`, atalho `npm run backfill:finance-transactions`) que preenche o fluxo de caixa a partir de dados anteriores ao módulo — garante as categorias padrão de cada usuário e deriva **uma despesa por pedido dōTERRA** (`COMPRA` não-equipe) e **uma receita por pagamento de venda** (`VENDA` não-equipe, exceto `INFINITE_PAY`), reutilizando `syncExpenseFromOrder`/`syncIncomeFromPayment`. Como os helpers fazem upsert por pedido/pagamento, rodar novamente nunca duplica linhas. Aplicado na base `receivables_cliente`: 26 despesas (`PEDIDO_DOTERRA`, R$ 20.044,24) + 9 receitas (`VENDA`, R$ 1.968,30).

### Changed
- **`backend/src/services/financeSyncService.js`**: `syncExpenseFromOrder` passa a usar `order.totalValue` como valor do lançamento quando o pedido dōTERRA é **compartilhado por mais de um cliente** (itens ligados a dois ou mais `personId` distintos); nos demais pedidos mantém `doterraValue ?? totalValue`. Novo helper `orderHasMultipleClients` e export de `shouldSyncIncome` para reuso no backfill, mantendo a regra idêntica entre o sync em tempo real e a carga histórica.

### Tests
- Backend: `financeSync.test.js` ganhou 2 casos (15 no total) — pedido multi-cliente com `doterraValue` divergente usa `totalValue`; pedido de cliente único usa `doterraValue`. **731 backend passing**; `npm run lint` e Prettier limpos. Frontend sem alterações.

## Phase 99 — Módulo Financeiro: lançamentos, integração automática, frontend e remoção do dashboard (F3–F7) (2026-09-19)

### Added
- **Lançamentos manuais, listagem e resumo (F3, `/api/finances`)**: `GET /api/finances/transactions` devolve o conjunto filtrado completo (sem paginação no MVP), ordenado por `transactionDate` e `createdAt` desc, com filtros `type`, `origin`, `categoryId`, `from`/`to` inclusivos e `q` (descrição/observações, case-insensitive); cada linha inclui a `category` e, quando vinculada a um pagamento, o `feeAmount` derivado (informativo). `POST /api/finances/transactions` cria lançamento **manual** (`origin MANUAL` forçado; `amount > 0`; `categoryId`, quando informado, precisa ser do usuário e casar com o `type`). `PUT`/`DELETE /api/finances/transactions/:id` aceitam **apenas** linhas manuais — automáticas são rejeitadas com `400` (editar a origem). `GET /api/finances/summary` usa os mesmos filtros e devolve `totalIncome`/`totalExpense`/`balance` como strings fixas de 2 casas, calculadas em centavos inteiros sobre todo o conjunto filtrado. Serviço em `backend/src/services/financeTransactionsService.js`.
- **Integração automática e resgates InfinitePay (F4)**: `backend/src/services/financeSyncService.js` deriva lançamentos **dentro da mesma `$transaction`** da origem. `syncIncomeFromPayment` cria/atualiza **uma receita por pagamento** de venda (`origin VENDA`, `paymentId` único, categoria "Vendas", descrição `"Venda <orderNumber> — <cliente>"`) e **remove** a linha quando o pagamento vira `INFINITE_PAY` ou o pedido não é uma venda não-equipe; pagamentos em pedidos `COMPRA` **não** geram lançamento. `syncExpenseFromOrder` mantém **uma despesa** por pedido dōTERRA não-equipe (`origin PEDIDO_DOTERRA`, `amount = doterraValue ?? totalValue`, `transactionDate = orderDate`, categoria "Compra de produtos dōTERRA") e remove a linha quando o pedido vira equipe. Hooks em `paymentsService.js` (create/update) e `ordersService.js` (create/update de pedido e itens). `POST /api/finances/settlements` valida que o pedido pertence ao usuário, é `VENDA`, não é equipe e tem ao menos um pagamento `INFINITE_PAY`, criando uma receita vinculada (`origin RESGATE_INFINITEPAY`, `paymentId` nulo, categoria "Vendas"); múltiplos resgates parciais são permitidos.
- **Gestão de categorias no frontend (F5)**: hook `useFinanceCategories` concentra estado e I/O (listagem, formulário único criar/renomear, ativação lógica e visibilidade do modal) e `FinancialCategoryModal` usa o `Modal` compartilhado (fechamento polido via `useDirtyForm`, render-prop). Lista Receitas e Despesas separadas, marca padrão ("Padrão") e inativa ("Inativa"), permite criar para ambos os tipos, renomear inline (tipo imutável) e desativar/reativar (soft, reversível), com erros de validação/API no formulário.
- **Página de fluxo de caixa (F6)**: página nível 3 em `pages/Finances/` (shim `pages/FinancesPage.jsx`) com rota `/finances` e item de navegação **"Finanças"** (`Wallet`). `useFinances` concentra a listagem filtrada + resumo (filtros de tipo/origem/categoria/período refazem a busca em vigor; texto livre só no submit), o CRUD manual e a confirmação de exclusão; `useSaleSettlements` concentra o resgate InfinitePay e é reutilizado pela tela de Vendas. Componentes `FinancesSummary` (Receitas/Despesas/Saldo, saldo vermelho quando negativo), `FinancesToolbar`, `FinancesTable` (linhas manuais com menu kebab Editar/Excluir; automáticas somente leitura com link para a venda/pedido de origem e `feeAmount` informativo), `FinancialTransactionModal` (máscara ATM via `CurrencyInput`, apenas categorias ativas do tipo) e `GatewaySettlementModal`. A tela de Vendas ganhou a ação **"Registrar resgate InfinitePay"** para vendas com ao menos um pagamento `INFINITE_PAY` (`saleHasInfinitePay`).
- **E2E de finanças (F6)**: `frontend/e2e/finances.spec.js` (7 casos: listagem/totais, lançamento manual pela UI, filtro por tipo, layout largo do modal, despesa automática de pedido dōTERRA, resgate InfinitePay pela tela de Vendas e edição/exclusão manual) com screenshots estáveis em `frontend/e2e/screenshots/` (pasta ignorada pelo git). `frontend/e2e/helpers.js` ganhou helpers autenticados (produto/venda/pagamento/pedido/lançamento/resgate, listagem e resumo); cada execução cria usuário novo e apenas insere dados isolados.

### Changed
- **`frontend/src/utils/badgeStyles.js`**: novos mapas `FINANCIAL_TRANSACTION_TYPE_CLASSES` (RECEITA → `success`, DESPESA → `danger`) e `CATEGORY_BADGE_CLASSES`.
- **Layout do modal de categorias**: passou de `max-w-2xl` para `max-w-4xl`, seções empilhadas em coluna única, nome com `break-words` + `title` (sem `truncate`) e ações abaixo do nome em telas estreitas.
- **`ARCHITECTURE.md`** e `docs/swagger.js`: modelos/rotas financeiras e schemas `FinancialOrigin`, `FinancialTransaction`, `FinancialTransactionInput`, `FinancialTransactionUpdateInput`, `FinancialSummary` e `FinancialSettlementInput`; o guia de arquitetura frontend passou a citar `FinancesPage` como exemplo de nível 3.

### Removed
- **Dashboard (F7)**: removidos `backend/src/routes/dashboardRoutes.js`, `controllers/dashboardController.js`, `utils/dashboardProjection.js`, o mount `/api/dashboard` em `app.js`, a tag `Dashboard` e o schema `DashboardSummary` do swagger, e os testes `dashboard.test.js`/`dashboardProjection.test.js`. No frontend, removidos `pages/Dashboard/` (index, hook, componentes, helpers), `pages/DashboardPage.jsx`, a rota `/dashboard`, o item de navegação, os passos do dashboard no `OnboardingTour.jsx` e os testes `DashboardPage.test.jsx`/`BalanceChart.test.jsx`. O redirect da raiz `/` passou de `/products` para `/finances`. `frontend/src/utils/exportExcel.js` e seu teste ficam **dormentes** (sem chamador) para relatórios futuros. O e2e `team-orders.spec.js` CT4 passou a verificar que pedido de equipe não gera lançamento no fluxo de caixa.
- **`README.md`/`README.en.md`**: feature de dashboard/Excel substituída por **Finanças**.

### Fixed
- **Nome de categoria truncado no modal**: o nome completo ("Compra de produtos dōTERRA") não era visível; corrigido pelo layout largo + `break-words` descritos acima.

### Tests
- Backend: novos `financeTransactions.test.js` (37: CRUD manual, isolamento, rejeição de linha automática, validação, filtros combinados, `feeAmount` e resumo), `financeSync.test.js` (13: receita por pagamento PIX/dinheiro, ausência em InfinitePay e em pedido dōTERRA, re-sync/remoção ao editar pagamento, despesa única por pedido, equipe sem lançamento e remoção por exclusão) e `financeSettlements.test.js` (12: auth, criação vinculada, resgates parciais, `404` de pedido alheio, rejeições `400`). Removidos `dashboard.test.js` e `dashboardProjection.test.js` (F7). **729 backend passing**; teste funcional ao vivo dos endpoints F3/F4 (26 + 59 verificações) e `npm run lint`/`format:check` limpos.
- Frontend: novos `financeHelpers.test.js` (17), `FinancesPage.test.jsx` (13: totais, listagem, taxa informativa, link de origem, ações só em manuais, filtros, busca no submit, CRUD manual e fechamento polido), `FinancesSettlement.test.jsx` (5) e `FinanceCategories.test.jsx` (11 + 1 de layout). Atualizados `navigation.test.js`, `Header.test.jsx`, `MobileDrawer.test.jsx` e `App.test.jsx` (redirect para `/finances`); removidos `DashboardPage.test.jsx` e `BalanceChart.test.jsx`. **865 frontend passing**.
- E2E Playwright: `finances.spec.js` (7) e `team-orders.spec.js` ajustado (4 passando). `npm run lint` sem erros (5 warnings preexistentes), `npm run format:check` limpo e `npm run build` limpo.

## Phase 98 — Módulo Financeiro: modelo de dados e categorias (F1–F2) (2026-09-19)

### Added
- **Modelo de dados financeiro (F1)**: enums `FinancialTransactionType` (`RECEITA` | `DESPESA`) e `FinancialOrigin` (`VENDA` | `RESGATE_INFINITEPAY` | `PEDIDO_DOTERRA` | `MANUAL`), models `FinancialCategory` (por usuário, `@@unique([userId, type, name])`, `isDefault`, `active` com desativação lógica) e `FinancialTransaction` (lançamento de caixa já **compensado**: `amount` `Decimal(10,2)`, `description`, `transactionDate` `DATE`, `notes` opcional, `categoryId` `ON DELETE SET NULL`, `orderId`/`paymentId` nulos com `ON DELETE CASCADE`, `paymentId` único). Migration `20260919150000_add_finances_module`; relações reversas em `User`, `Order` e `Payment`.
- **Categorias padrão por usuário (F1)**: `backend/src/utils/financeDefaults.js` com `DEFAULT_CATEGORIES` (4 receitas, 7 despesas), o mapa `ORIGIN_CATEGORY_NAMES`/`getDefaultCategoryName` (`VENDA`/`RESGATE_INFINITEPAY` → "Vendas"; `PEDIDO_DOTERRA` → "Compra de produtos dōTERRA"; `MANUAL` → sem padrão) e `ensureDefaultCategories` idempotente (`createMany` + `skipDuplicates`). O registro (`authController.register`) cria as categorias na mesma transação do usuário; usuários existentes são preenchidos por `backend/scripts/backfillFinanceCategories.js` (`npm run backfill:finance-categories`, com `--dry-run`).
- **Endpoints de categorias financeiras (F2, `/api/finances`)**: `GET /api/finances/categories` (lista ativas e inativas, garantindo as padrão no primeiro acesso), `POST /api/finances/categories` (categoria personalizada; `name` com trim; conflito `[userId, type, name]` → `409`), `PUT /api/finances/categories/:id` (renomear e/ou ativar/desativar; `type` imutável) e `DELETE /api/finances/categories/:id` (desativação lógica, preserva histórico). Implementação em `financeCategoriesService.js`, `financesController.js`, `financesValidator.js` e `financesRoutes.js`, montada em `app.js`. Todas as rotas são protegidas por JWT e escopadas por `userId` (categoria de outro usuário → `404`). O seed é protegido pela contagem de categorias `isDefault`, então renomear uma categoria padrão não a recria no próximo acesso.
- **`conflict` (409)** em `backend/src/utils/httpError.js`.
- **Swagger**: tag `Finances` e schemas `FinancialTransactionType`, `FinancialCategory`, `FinancialCategoryInput` e `FinancialCategoryUpdateInput`.

### Changed
- **`ARCHITECTURE.md`**: modelo de dados financeiro, estrutura de services/validators e a área de API `/api/finances`.

### Tests
- Backend: `financeDefaults.test.js` (9) e `financeCategories.test.js` (24) cobrindo o conjunto padrão, idempotência, isolamento por usuário, uso em transação, integração com o registro, CRUD, validação, conflitos `409`, desativação lógica, `404` para categoria alheia/inexistente e não-recriação de default renomeada; `httpError.test.js` ganhou o caso `conflict`. **695 backend passing**; `npm run lint` (backend) e `npm run format:check` limpos. Teste funcional manual dos 8 endpoints (27 verificações: defaults no primeiro acesso, criação, conflitos, validação, rename, desativação/reativação, isolamento e não-recriação de default renomeada) validado contra o backend em execução.

## Phase 97 — Script de atualização para máquina do cliente (Windows) (2026-09-19)

### Added
- **`update.bat`**: novo script de atualização para instalações Windows do cliente. Segue o roteiro de `docs/DEPLOYMENT.md`: verifica Node.js/Git, bloqueia a execução se detectar serviços nas portas `3000`/`4000`, confere se há commits pendentes e só então exige confirmação de backup do banco, executa `git pull`, `npm ci` no backend e frontend, `prisma migrate deploy`, `prisma generate`, `npm run build` no frontend e, ao final, oferece iniciar o projeto chamando `start.bat`. Quando não há atualizações pendentes, informa **"PROJETO JA ESTA ATUALIZADO"** e pula direto para a oferta de iniciar, sem executar os comandos de atualização.
- **`check-updates.bat`**: helper compartilhado por `start.bat` e `update.bat`. Faz `git fetch` e compara o branch local com `origin/<branch>`, exportando `CURRENT_BRANCH` e `COMMITS_BEHIND` para o ambiente do chamador; retorna 1 quando não é possível verificar (sem Git, remote ou rede).
- **Script `prisma:migrate:deploy` no backend**: adicionado `backend/package.json` script `"prisma:migrate:deploy": "prisma migrate deploy"` para garantir deploy seguro das migrations em produção (sem usar `migrate dev`).
- **Verificação de atualização no `start.bat`**: antes de iniciar o projeto, chama `check-updates.bat`; se houver commits pendentes, pergunta se deseja executar o `update.bat`; em caso positivo, chama `update.bat --from-start` e, ao final, retoma a inicialização. Falhas silenciosas (sem internet/Git) seguem o fluxo normal.

### Fixed
- **Parênteses não escapados em blocos `if` dos `.bat`**: `update.bat` e `start.bat` usavam `(...)` dentro de blocos entre parênteses (ex.: `(S/N)`, `(pressione Ctrl+C e confirme)`, `(sem conexao ou sem remote)`), o que fechava o bloco prematuramente e fazia o script abortar sempre com a saída truncada. Os textos foram reescritos sem parênteses e o fluxo de atualização do `start.bat` foi reestruturado com rótulos (`goto`), eliminando também a expansão de `%UPDATE_NOW%`/`%ERRORLEVEL%` no parse do bloco. A detecção de portas passou a considerar apenas `LISTENING` com correspondência literal (`findstr /C:":4000 "`).

### Tests
- `npm run format:check` limpo e `npm run lint` no backend sem erros. O script `.bat` não é executável em ambiente Linux, mas sua estrutura foi validada contra o `start.bat` existente.

## Phase 96 — Taxa do InfinitePay no registro de pagamento de vendas (2026-09-19)

### Added
- **Valor líquido e taxa no pagamento**: `Payment.netAmount` (`Decimal(10,2)` nullable) guarda o valor que o usuário efetivamente recebeu após a taxa da maquininha; `null` significa sem taxa (líquido = valor cobrado). A taxa é **sempre derivada** (`amount - netAmount`) por `backend/src/utils/paymentFee.js` e `frontend/src/utils/paymentFee.js`, nunca persistida. Migration `backend/prisma/migrations/20260919140000_add_gateway_fee_fields/migration.sql`.
- **Checkbox de repasse e campo de líquido no modal de pagamento**: em `SalePaymentModal.jsx` e `SaleEditPaymentModal.jsx`, ao selecionar **InfinitePay** aparecem o checkbox **"Repassar taxa do InfinitePay ao cliente"** e o campo **"Valor líquido recebido (R$)"** (`salePaymentNetAmount` / `saleEditPaymentNetAmount`), com a taxa exibida em tempo real (`sale-payment-fee` / `sale-edit-payment-fee`). O checkbox é refletido ao reabrir a edição.
- **Flag de repasse na venda**: `Order.passesGatewayFeeToClient` (Boolean, default `false`) registra que a taxa foi repassada ao cliente. O campo `passesGatewayFeeToClient` é aceito opcionalmente pelos endpoints de pagamento (`POST /api/orders/:orderId/payments`, `PUT /api/orders/payments/:id`) e persistido na ordem dentro da mesma transação; quando omitido, a ordem não é alterada.
- **Detalhamento e Excel**: o `SaleDetailsModal.jsx` passou a exibir `Taxa` e `Líquido` por pagamento (`payment-fee-<id>`); a exportação (`frontend/src/utils/exportExcel.js`) ganhou as colunas **Taxa (R$)** e **Líquido (R$)** na aba **Vendas** e **Taxa (R$)** / **Valor Líquido (R$)** no **Histórico de Pagamentos**.

### Changed
- **API de pagamento**: `netAmount` e `passesGatewayFeeToClient` entraram em `backend/src/validators/paymentsValidator.js`; `backend/src/services/paymentsService.js` rejeita `netAmount > amount` (`400 Net amount cannot be greater than the charged amount`) e retorna `feeAmount` derivado em `payment`. O saldo continua sendo quitado por `amount` com pendente limitado a zero, então o repasse da taxa **não gera crédito/sobrepagamento**.
- **Aviso de sobrepagamento**: o guard do frontend passou a comparar o **líquido recebido** (ou o valor cobrado quando não há líquido) com o saldo pendente, de modo que uma taxa repassada ao cliente (cobrado > pendente, líquido == pendente) não dispara a confirmação de valor acima do saldo.
- **Checkbox reposicionado**: a marcação de repasse fica no modal de pagamento (não no formulário de venda), já que não altera o layout em nenhum dos cenários (taxa repassada ou absorvida).
- **`ARCHITECTURE.md`** atualizado (campos `Order.passesGatewayFeeToClient`/`Payment.netAmount`, taxa de gateway e colunas do Excel).

### Tests
- Backend: `salesPayments.test.js` (+12: líquido e taxa derivada nos dois cenários, `netAmount` nulo/sem taxa, rejeição de líquido maior que o cobrado, edição/limpeza do líquido e persistência do flag de repasse via pagamento). **661 backend passing**.
- Frontend: `SalesPayments.test.jsx` (campo líquido e checkbox só para InfinitePay, taxa calculada, payloads com `netAmount`/`passesGatewayFeeToClient`, pré-preenchimento na edição e `Taxa`/`Líquido` no detalhamento), `exportExcel.test.js` (colunas e valores de taxa/líquido) e `SalesPage.test.jsx` ajustado. **850 frontend passing**.
- `npm run lint` sem erros (5 warnings preexistentes), `npm run build` limpo e `npm run format:check` limpo.

## Phase 95 — Frete/adicionais no saldo pendente de vendas e detalhamento de cliente único (2026-09-19)

### Changed
- **Detalhamento da venda sem accordion de pessoas**: como a venda tem um único cliente, o modal `SaleDetailsModal.jsx` deixou de exibir a lista de pessoas em accordion e passou a mostrar diretamente os itens e os pagamentos recebidos (com a ação de editar cada pagamento), dando ênfase ao **Valor Pendente** no cabeçalho (`text-accent` + negrito). O estado `expandedPersonId`/`toggleDetailPerson` foi removido de `useSalePayments.js` e `Sales/index.jsx`; `detailBalances` deixou de ser exposto pelo hook (segue usado internamente no cálculo do pendente ao editar um pagamento).
- **`ARCHITECTURE.md`** atualizado (saldo de venda com frete/adicionais e detalhamento de cliente único).

### Fixed
- **Frete e Valores Adicionais agora entram no saldo pendente da venda**: o `GET /api/orders/:id/balance` calculava o pendente por pessoa apenas como itens − pagamentos, ignorando o frete e os adicionais da venda. Como o cliente da venda é sempre não-self, `buildOrderBalances` (`backend/src/utils/orderBalances.js`) passou a distribuir `shippingValue + additionalValue` entre as pessoas não-self (na prática o cliente único) e somá-los ao `pending`; `itemTotal` permanece a soma dos itens. Isso corrige o modal de pagamento/detalhamento que mostrava R$ 100,00 de saldo numa venda de R$ 100,00 + R$ 14,70 de frete e disparava o aviso de valor acima do saldo ao registrar R$ 114,70. Pedidos de compra (`COMPRA`) mantêm o comportamento anterior.
- **Valor Pendente invisível no detalhamento da venda**: o realce usava a classe `text-base`, que o tema resolve como a **cor** `base` (`--bg`, o próprio fundo) e não como tamanho de fonte. O valor pendente passou a seguir o mesmo padrão do valor do produto na lista de itens (`text-sm font-semibold text-accent whitespace-nowrap`), permanecendo `text-ink-faint` quando zerado.

### Tests
- Backend: `orderBalances.test.js` (+5: venda soma frete + adicionais sem alterar `itemTotal`, subtrai pagamentos, rateia entre não-self, ignora self e ignora frete em `COMPRA`) e `salesPayments.test.js` (pendente 200 + 10 + 5 − 150 = 65; quitação só após pagar o frete). **649 backend passing**.
- Frontend: `SalesPayments.test.jsx` ajustado (mocks alinhados ao saldo com encargos, detalhamento sem accordion e ênfase no pendente). **841 frontend passing**.
- `npm run lint` sem erros (5 warnings preexistentes), `npm run build` limpo e `npm run format:check` limpo.

## Phase 94 — Descrição de venda/pedido ampliada para 2000 caracteres (2026-09-19)

### Changed
- **Descrição de venda e pedido ampliada de 500 para 2000 caracteres**: o campo compartilhado `Order.orderNotes` — exibido em Vendas como "Descrição da Venda" e em Pedidos como "Descrição do Pedido" — passou a aceitar até 2000 caracteres. O banco foi alterado para `VARCHAR(2000)` na migration `backend/prisma/migrations/20260919130000_widen_order_notes_to_2000/migration.sql`; `backend/src/validators/salesValidator.js` (`description` em create/update) e `backend/src/validators/ordersValidator.js` (`orderNotes`) passaram a `.max(2000)`; o Swagger (`backend/src/docs/swagger.js`) reflete `maxLength: 2000` em `SaleInput`/`SaleUpdateInput`/`OrderInput`/`OrderUpdateInput`; `frontend/src/pages/Sales/components/SaleForm.jsx` e `frontend/src/pages/Orders/components/OrderForm.jsx` atualizaram o `maxLength` e o contador para `/2000`. Os "Detalhes do Item" (`Item.details`) permanecem limitados a 500 caracteres.

### Tests
- Backend: `sales.test.js` (+2: aceita descrição com 2000 e rejeita com 2001) e `orders.test.js` (+1 e ajuste: aceita `orderNotes` com 2000 e rejeita com 2001). **643 backend passing**.
- Frontend: `SalesPage.test.jsx` (+1: contador da descrição da venda) e `OrdersPage.test.jsx` ajustado para os contadores `0/2000` e `8/2000`. **841 frontend passing**.
- `npm run lint` sem erros (5 warnings preexistentes), `npm run build` limpo e `npm run format:check` limpo.

## Phase 93 — Simulador de Pedido: promoção, frete e campos numéricos (2026-09-19)

### Added
- **Promoção por produto no Simulador de Pedido**: nova coluna **`% Promo`** (`simulator-discount-N`) entre Qtd e PV unit. em `frontend/src/pages/Orders/components/OrderSimulatorRow.jsx`. O percentual é limitado a **0–100 no próprio campo** (`max={100}` do `NumericInput`, via `clampToMax`) e reforçado no cálculo por `normalizeDiscountPercent`; o desconto é aplicado ao PV e ao Valor Membro de cada linha, e as colunas unitário/total já exibem os valores descontados. `createEmptyRow` passa a iniciar com `discountPercent: 0`.
- **Frete e Valor Total do Pedido no simulador**: rodapé reformulado em quatro cards (`OrderSimulatorModal.jsx`) — "Soma dos PV", "Soma do Valor Membro" (mantida), "Frete (R$)" editável (`simulator-shipping`, `CurrencyInput`) e "Valor Total do Pedido" (`simulator-order-total` = soma do Valor Membro + frete, em centavos). O frete é efêmero (`shippingValue`/`updateShipping` em `useOrderSimulator.js`, com `shippingCentsFromValue`) e é zerado ao abrir, fechar ou limpar o simulador.
- **Campo numérico compartilhado `NumericInput`** (`frontend/src/components/NumericInput.jsx`): input de texto com semântica numérica (`inputMode` `numeric`/`decimal`) que elimina as setas do `type="number"`. Sanitiza a digitação (`sanitizeIntegerInput`/`sanitizeDecimalInput`, com vírgula normalizada para ponto) e aceita `max` opcional (`clampToMax`).

### Changed
- **Campos numéricos migrados de `type="number"` para `NumericInput`** em toda a aplicação: PV doTERRA e Quantidade do item em Pedidos, Quantidade do item em Vendas, PV e Quantidade do componente do kit em Produtos, Quantidade em Estoque e Qtd/% Promo no Simulador. Apenas números são aceitos e valores negativos deixam de ser digitáveis; a validação "PV doTERRA não pode ser negativo" permanece como salvaguarda para pedidos carregados com valor negativo.
- **`ARCHITECTURE.md`**: `NumericInput` adicionado à lista de widgets compartilhados de `src/components/`.

### Fixed
- O campo **`% Promo`** aceitava valores acima de 100 durante a digitação (ex.: 150) e apenas o cálculo truncava; agora o próprio campo limita o valor a 100.

### Tests
- **Simulador**: `simulatorHelpers.test.js` (+10: desconto por linha e nos totais, limite de 100%, valores inválidos/negativos e frete) e `OrderSimulatorModal.test.jsx` (+3: promoção aplicada, limite de 100% no campo e frete no Valor Total).
- **`NumericInput.test.jsx`** (novo, 12 testes): sanitização inteira/decimal, normalização de vírgula, ausência de setas, `max`/`clampToMax` e estado desabilitado; `OrdersPage.test.jsx` ajustado (digitar valor negativo apenas remove o sinal; dados carregados negativos continuam bloqueando o envio).
- **840 frontend tests passing** (backend inalterado); `npm run lint` sem erros (5 warnings preexistentes), `npm run build` limpo e `npm run format:check` limpo.

## Phase 92 — Cliente no nível do pedido de equipe e ajustes de Vendas/pagamentos (2026-09-19)

### Added
- **Cliente no nível do pedido de equipe**: na tela de Pedidos dōTERRA o cliente de um pedido `isTeamOrder` passou a ser escolhido no nível do pedido, e não mais por item. O select "Cliente" (`order-team-person`, logo abaixo do checkbox "Pedido da equipe" em `frontend/src/pages/Orders/components/OrderForm.jsx`) vincula a pessoa escolhida a todos os itens; o select por item (`order-item-person-N`, `OrderItemFields.jsx`) só aparece no modo legado. O cliente continua persistido em `Item.personId` — a mesma estrutura usada pelo self person nos pedidos comuns — sem alteração de schema. `useOrders.js` sincroniza o cliente em todos os itens, herda-o em itens adicionados e valida "Cliente é obrigatório". Ao editar pedidos anteriores à mudança, `deriveTeamClientFromItems` (`frontend/src/pages/Orders/utils/orderHelpers.js`) adota o modo por pedido quando todos os itens compartilham o mesmo cliente (ou nenhum) e mantém o modo por item quando os clientes divergem; unificar um pedido legado sob um cliente abre um `ConfirmDialog` ("Ao escolher um cliente para todo o pedido, todos os itens serão vinculados a essa pessoa. Deseja continuar?").
- **Coluna "Cliente" na lista de Pedidos**: logo após "Conta ID" (`OrdersTable.jsx`), com `getOrderClientLabel` (`orderHelpers.js`) exibindo o cliente único do pedido de equipe, `Vários` quando os itens divergem e `Eu (você)` para pedidos comuns. Larguras rebalanceadas: Descrição 32%→20% e nova coluna Cliente em 12%.
- **Forma de pagamento Dinheiro**: novo valor `DINHEIRO` no enum Prisma `PaymentType` (`backend/prisma/schema.prisma`), migration `backend/prisma/migrations/20260919120000_add_dinheiro_payment_type/migration.sql` (`ALTER TYPE ... ADD VALUE 'DINHEIRO'`), `backend/src/utils/paymentTypes.js` sincronizado com o Zod e badge/tokens (`badgeStyles.js`, `index.css`, `tailwind.config.js`, `paymentTypeLabel`, `scripts/contrast-check.mjs`).
- **Backfill de status de pedidos**: `backend/scripts/resyncOrderStatuses.js` (idempotente, `--dry-run`, exposto como `npm run fix:order-status`) recalcula o status de todos os pedidos com `computeOrderStatus`; `syncOrderStatuses` (`backend/src/utils/receivables.js`) passou a aceitar `{ dryRun }` e a retornar as divergências `{ id, from, to }`.

### Changed
- **Pagamentos da tela de Vendas** restritos a **PIX**, **InfinitePay** e **Dinheiro** (opção "Não informada" mantida), enquanto os Pedidos seguem com a lista completa (PIX, Boleto, Crédito, InfinitePay). `PAYMENT_TYPE_OPTIONS` (`frontend/src/pages/Sales/utils/saleHelpers.js`) é consumido por `SalePaymentModal.jsx` e `SaleEditPaymentModal.jsx`, que mantêm o tipo legado do pagamento em edição.
- **Kit em vendas**: a tela de Vendas deixou de exibir os radios "Como enviar para o estoque?"; como venda é saída de estoque, o item KIT sempre movimenta o próprio kit (`kitStockMode: 'KIT'`, definido em `useSales.js` e reforçado no payload, inclusive para itens legados salvos como `COMPONENTS`), sem validação manual. `SaleItemFields.jsx` deixou de renderizar os radios e o label do cashback passou de "Valor Membro c/ 70% de desconto (total)" para **"Valor 70%"**.
- **Status ao editar pagamento**: `createPayment`/`updatePayment` passaram a considerar o `additionalValue` da venda (`additionalCents` em `computeOrderStatus`, `backend/src/services/paymentsService.js`), evitando que uma venda permaneça `QUITADO` após o pagamento ser reduzido.
- **`ARCHITECTURE.md`** atualizado (pagamentos da Vendas, item KIT e cliente no nível do pedido de equipe).

### Fixed
- Correção retroativa de pedidos persistidos com status incorreto por não considerarem o `additionalValue`; o backfill foi aplicado no banco local (1 status corrigido: `V-0001` `QUITADO` → `PARCIAL`).

### Tests
- Backend: `payments.test.js` e `salesPayments.test.js` (DINHEIRO aceito, `'CHEQUE'` inválido; `PARCIAL`/`QUITADO` com adicional) e `orderStatusSync.test.js` (+4, backfill e `dryRun`). **640 backend passing**.
- Frontend: `OrdersPage.test.jsx` (+7) cobrindo o select de cliente no nível do pedido, propagação aos itens, obrigatoriedade, hidratação no modo por pedido, modo legado com clientes divergentes, confirmação de unificação e a coluna Cliente; `SalesPayments.test.jsx` e `badgeStyles.test.jsx` para as opções limitadas de pagamento; `SalesPage.test.jsx` (+3) para ausência dos radios de kit, envio de `kitStockMode: 'KIT'` e label "Valor 70%". **814 frontend passing**.
- E2E Playwright: novo `frontend/e2e/team-order-client.spec.js` (criação com cliente no pedido, hidratação na edição, modo legado divergente e unificação com confirmação) e ajustes em `frontend/e2e/team-orders.spec.js` (seleção pelo novo select e asserção da coluna Cliente); **8 E2E passing**. Corrigido também o alvo do teste do dashboard (`/dashboard`, pois a raiz passou a redirecionar para Produtos).
- `npm run lint` sem erros (5 warnings preexistentes), `npm run build` limpo, `npm run format:check` limpo e `contrast-check` WCAG AA ok.

## Phase 91 — Simulador de Pedidos na tela de Pedidos dōTERRA (2026-09-13)

### Added
- **Simulador de Pedido** na tela de Pedidos: botão "Simulador" ao lado de "Novo Pedido" em `frontend/src/pages/Orders/index.jsx` abre um modal em formato de planilha onde o usuário escolhe produtos, informa quantidades e vê, em tempo real, o PV unitário/total e o Valor Membro unitário/total de cada linha, além dos somatórios "Soma dos PV" e "Soma do Valor Membro" no rodapé. A simulação é efêmera: ao fechar o modal as linhas são descartadas e nada é enviado à API.
- **Componentes do simulador** em `frontend/src/pages/Orders/components/`: `OrderSimulatorModal.jsx` (chrome do modal, botão "Adicionar linha", tabela, totais e ações "Limpar"/"Fechar") e `OrderSimulatorRow.jsx` (combobox de produto, quantidade e colunas derivadas somente leitura). Linhas são independentes — o mesmo produto pode aparecer mais de uma vez e cada linha soma separadamente.
- **Estado efêmero** em `frontend/src/pages/Orders/useOrderSimulator.js` (`rows`, `addRow`, `removeRow`, `updateRowField`, `clearAll`, abrir/fechar), isolando a feature das demais responsabilidades de `useOrders.js`.
- **Cálculos puros** em `frontend/src/pages/Orders/utils/simulatorHelpers.js` (`createEmptyRow`, `rowTotals`, `totalsFor`, `formatPv`, `formatMemberCents`), com PV e valores de membro derivados do produto do catálogo. KITs usam o PV/preço do próprio kit (sem expandir componentes), sem qualquer ajuste de cashback.

### Tests
- Novos `frontend/tests/simulatorHelpers.test.js` (15 testes: multiplicação por quantidade, KIT como produto único, quantidades inválidas, ausência de preço, deriva de ponto flutuante e formatação) e `frontend/tests/OrderSimulatorModal.test.jsx` (8 testes: estado vazio, adicionar/selecionar/alterar/remover linhas, linhas duplicadas, limpar e descarte ao fechar).
- `frontend/tests/OrdersPage.test.jsx` ganhou 4 casos de integração (botão no header, totais calculados a partir do catálogo, descarte ao fechar e independência em relação ao formulário de pedido real).
- **801 frontend tests passing** (backend inalterado); `cd frontend && npm run lint` sem erros (5 warnings preexistentes), `cd frontend && npm run build` limpo e `npm run format:check` limpo.

## Phase 90 — Coluna Origem na lista de Pedidos dōTERRA (2026-09-13)

### Added
- **Coluna "Origem"** em `frontend/src/pages/Orders/components/OrdersTable.jsx`, logo após "Valor": badge `Usuário` (neutro) para pedidos comuns e `Equipe` (roxo) para `isTeamOrder`, tornando explícita a distinção que antes dependia da ausência da ação de pagamento.
- **Badge centralizado**: `OrderOriginBadge` em `frontend/src/pages/Orders/components/Badges.jsx`, consumindo `ORDER_ORIGIN_CLASSES` (`user` = `bg-base text-ink-soft`, `team` = `bg-mystic-soft text-mystic-fg`) em `frontend/src/utils/badgeStyles.js`.

### Changed
- **Larguras das colunas rebalanceadas** para acomodar Origem (8%) sem alterar Descrição (32%) e Ações (14%): Número 10→9, Data 8→7, Conta ID 10→9, Pagamento 9→7, PV 8→7 e Valor 9→7.

### Tests
- Frontend (`frontend/tests/OrdersPage.test.jsx`): novos casos para a posição da coluna (imediatamente após "Valor") e para os badges `Usuário`/`Equipe`; cabeçalho "Origem" incluído na verificação de Title Case. **774 frontend tests passing** (backend inalterado); `cd frontend && npm run lint` sem erros (5 warnings preexistentes), `cd frontend && npm run build` limpo e `npm run format:check` limpo.

## Phase 89 — Raiz abre Produtos e Dashboard na última posição do menu (2026-09-12)

### Changed
- **Raiz redireciona para Produtos**: em `frontend/src/App.jsx`, a rota `/` deixou de renderizar o `DashboardPage` e passou a redirecionar (`<Navigate to="/products" replace />`); o Dashboard ganhou rota própria em `/dashboard`, dentro do bloco protegido. Como o `LoginPage` continua navegando para `/` após o login (`frontend/src/pages/LoginPage.jsx`), o usuário passa a cair na tela de Produtos automaticamente. O catch-all `*` segue redirecionando para `/`, agora resolvido em Produtos.
- **Dashboard movido para a última posição do menu**: `Header.jsx` (desktop) e `MobileDrawer.jsx` (mobile) passam a exibir a ordem Clientes → Pedidos dōTERRA → Vendas → Produtos → Estoque → Dashboard, com o item Dashboard apontando para `/dashboard`.
- **Lista de navegação extraída para módulo compartilhado**: novo `frontend/src/utils/navigation.js` exporta `navigationItems` (rota, ícone e rótulo PT-BR), consumido por `Header.jsx` e `MobileDrawer.jsx`, eliminando a duplicação das duas listas.

### Tests
- Novo `frontend/tests/navigation.test.js` (ordem, rótulos, ícones e unicidade de rotas) e `frontend/tests/App.test.jsx` (raiz cai em Produtos, `/dashboard` renderiza o Dashboard e rotas desconhecidas redirecionam para Produtos).
- `Header.test.jsx` e `MobileDrawer.test.jsx` ganharam asserções de ordem dos itens (Dashboard por último) e do link `/dashboard`.
- **772 frontend tests passing** (backend inalterado); `cd frontend && npm run lint` sem erros (5 warnings preexistentes), `cd frontend && npm run build` limpo e `prettier --check` limpo nos arquivos alterados.

## Phase 88 — Design system rosa (claro) / Dracula (escuro) com suporte a tema (2026-09-12)

### Added
- **Design tokens semânticos** em `frontend/src/index.css` (`:root` claro / `.dark` escuro) expostos no `frontend/tailwind.config.js`: superfícies (`base`, `surface`, `elevated`), bordas (`line`), tiers de texto (`ink`/`ink-soft`/`ink-faint`), família de acento (`accent`/`accent-hover`/`accent-soft`/`accent-on`/`accent-on-soft`), paleta de apoio (`success`, `warning`, `info`, `mystic`, `danger` como `*-soft` + `*-fg`) e badges de pagamento (`badge.boleto`/`badge.infinitepay`/`badge.pix`). O modo escuro segue o Dracula (`#1E1F29`, `#282A36`, `#44475A`, `#F8F8F2`, acento `#FF79C6`).
- **Mapa central de cores de badge** em `frontend/src/utils/badgeStyles.js`: status de pedido/venda (Pendente=amarelo, Parcial=ciano, Quitado=verde, Equipe=roxo), tipos de pagamento (PIX=verde, Boleto=laranja, InfinitePay=rosa, Crédito=roxo), entrega, status de produto, movimentos de estoque, quantidade em estoque e booleano — consumido por `Badges.jsx`, `SaleBadges.jsx`, `BoolBadge.jsx`, `productHelpers.js` e `stockHelpers.js`.
- **Script de verificação de contraste** `frontend/scripts/contrast-check.mjs` (WCAG AA ≥ 4,5:1) lendo os pares fg/bg direto do `index.css`, nos dois modos.

### Changed
- **Paleta azul substituída por rosa como acento + paleta de apoio**: removidos `primary-*`, `blue-*`, `indigo-*`, `emerald-*`, `amber-*` e os gradientes `brand-gradient` (código morto). Todas as telas (Dashboard, Clientes, Pedidos dōTERRA, Vendas, Produtos, Estoque), Login/Registro e componentes compartilhados passam a consumir os tokens semânticos. O rosa é usado apenas como sinalização (ações primárias, links, item de navegação ativo, foco de campos, indicadores de progresso/seleção); badges e status usam a paleta secundária para evitar monotonia.
- **Barra de navegação e drawer neutros** (`Header.jsx`, `MobileDrawer.jsx`): o gradiente azul deu lugar a `bg-surface` + borda, com o item ativo em `text-accent-on-soft`/`bg-accent-soft`.
- **Botões primários sólidos** (`bg-accent hover:bg-accent-hover text-accent-on`), sem gradiente; foco em `ring-accent`/`ring-offset-surface`. Cards passam a `border border-line` em vez da borda superior azul de 4px; linhas de tabela com hover `bg-accent-soft`; rótulos mobile (`data-label`) sem `uppercase`; spinners em `border-accent`.
- **`BalanceChart` ciente do tema**: lê os tokens via `getComputedStyle` (com fallback para jsdom) e recalcula ao alternar claro/escuro; barras Itens=acento e Pagamentos=verde.
- **Toast** escurecido para `bg-green-700`/`bg-red-700` (contraste AA com texto branco).
- **Ajustes de tom para AA**: Boleto claro `#9C5306` (era `#B5650A`, 3,68:1), vermelho escuro `#FF7B7B` (era `#FF5555`, 3,83:1), roxo escuro `#C4A2FB` (era `#BD93F9`, 4,41:1) e novo token `--accent-on-soft` para texto de acento sobre fundos soft/base.

### Removed
- Paleta `primary` e os `backgroundImage.brand-gradient`/`brand-gradient-soft` do `tailwind.config.js`, além das variáveis `--brand-gradient*` do `index.css`.
- Classes de paleta crua e variantes `dark:` de cor em `frontend/src` (os tokens já resolvem por modo).

### Tests
- Novos `frontend/tests/badgeStyles.test.jsx` (mapas completos, fallbacks e ausência de paleta crua/hex) e `frontend/tests/BalanceChart.test.jsx` (cores por token e tema persistido).
- Asserções ancoradas em classe atualizadas em `MobileDrawer`, `OrdersPayments`, `OrdersPage`, `PeoplePage`, `SalesPage` e `DashboardPage` (agora renderizado sob `ThemeProvider`).
- **631 backend + 761 frontend tests passing**; `npm run lint` sem erros (5 warnings preexistentes), `cd frontend && npm run build` limpo, `npm run format:check` limpo e `node frontend/scripts/contrast-check.mjs` com 30/30 pares AA.

## Phase 87 — Tipos de pagamento do pedido e tooltip de itens no número do pedido (2026-09-12)

### Changed
- **Formulário de Pedido limitado a PIX, Boleto e Crédito**: o select `Tipo de Pagamento` do `OrderForm` (`frontend/src/pages/Orders/components/OrderForm.jsx`) deixou de exibir `InfinitePay` e renomeou a opção `CARTAO_CREDITO` de "Cartão de Crédito" para **Crédito**. A mudança vale apenas para o campo em nível de pedido (`Order.paymentType`); os modais de pagamento (`PaymentModal`, `EditPaymentModal`) e a tela de Vendas mantêm a lista completa.
- **Rótulo "Crédito" propagado**: `paymentTypeLabel` (`frontend/src/pages/Orders/utils/orderHelpers.js`) passou a devolver `Crédito` para `CARTAO_CREDITO`, refletindo também no `PaymentTypeBadge` da tabela e no modal de detalhamento. Pedidos legados com `INFINITE_PAY` continuam exibindo `InfinitePay`.
- **Tooltip dinâmico no número do pedido**: o `title` estático "Ver pedido no site" do link do número (`frontend/src/pages/Orders/components/OrdersTable.jsx`) foi substituído por `getOrderNumberTooltip(order)` (`orderHelpers.js`). Para pedidos comuns, lista uma entrada por item no formato `{produto} (Paguei R$ {valor da linha})`, unidas por ` / `, sem separador ao final; para pedidos da equipe, agrupa por produto único e usa `Pago R$` no lugar de `Paguei R$`. O valor usa o total da linha (campo "Valor Pago (total)"), respeitando o modo UNIT/TOTAL.

### Tests
- Frontend (`frontend/tests/OrdersPage.test.jsx`): teste das opções do `Tipo de Pagamento` reescrito para garantir PIX/Boleto/Crédito e a ausência de "Cartão de Crédito"/"InfinitePay"; novo bloco `Order number tooltip` com seis casos (pedido comum por item, item único sem separador final, multiplicação por quantidade, agrupamento por produto em pedido da equipe, produtos distintos, pedido sem itens); teste do badge `Crédito` na lista; teste de links de rastreio ajustado para o novo atributo `title`.
- Frontend (`frontend/tests/OrdersPayments.test.jsx`): expectativa do badge do modal de detalhamento atualizada para `Crédito`. **631 backend + 752 frontend tests passing**; lint sem erros (5 warnings preexistentes), `cd frontend && npm run build` limpo e `prettier --check` limpo nos arquivos alterados (apenas o `backend/src/app.js` preexistente segue sinalizado).

## Phase 86 — Ajustes da lista de Pedidos dōTERRA: caixa mista dos cabeçalhos, larguras, ordenação e remoção do filtro de pagamento (2026-09-12)

### Changed
- **Cabeçalhos de todas as tabelas padronizados em caixa mista** (primeira letra maiúscula, ex.: "Pagamento", "PV", "Valor", "Descrição", "Ações"): a classe `uppercase` foi removida do `SortableHeader` (`frontend/src/components/SortableHeader.jsx`), o que afeta toda coluna ordenável, e dos `<th>` estáticos de `OrdersTable.jsx`, `PeopleTable.jsx` (WhatsApp/Instagram), `SalesTable.jsx` (Recebido/Ações), `ProductsTableHeader.jsx` (Site/Status/Ações), `StockTable.jsx` (Ações) e `HistoryDialog.jsx` (Data Efetiva, Data de Registro, Tipo, Quantidade, Motivo). Os rótulos mobile (`data-label`) e o texto dos cabeçalhos não mudaram.
- **Larguras em Pedidos dōTERRA**: a coluna "Descrição" passou de `w-[26%]` para `w-[32%]` e "Ações" de `w-[20%]` para `w-[14%]` (`frontend/src/pages/Orders/components/OrdersTable.jsx`), ampliando o texto visível da descrição e reduzindo o espaço do menu de ações.
- **Colunas renomeadas na lista de Pedidos dōTERRA**: "PV doTERRA" → **PV** e "Valor (R$)" → **Valor**, tanto no cabeçalho quanto no `data-label` mobile (`OrdersTable.jsx`); o rótulo do formulário "PV doTERRA" permanece inalterado.
- **Ordenação adicionada às colunas "Pagamento", "PV" e "Valor"**: as três passaram a usar o `SortableHeader` com os campos `paymentType`, `doterraPv` e `totalValue`, já suportados pelo backend (`ORDER_SORTABLE_FIELDS`/`GET /api/orders?sortBy=...`).
- **Filtro de tipo de pagamento removido da lista de Pedidos dōTERRA** (`frontend/src/pages/Orders/components/OrdersTableToolbar.jsx`, `useOrderFilters.js`, `useOrders.js`, `index.jsx`, `utils/orderHelpers.js`): o select "Tipo de pagamento" (`PAYMENT_TYPE_FILTER_OPTIONS`) e o estado `paymentTypeFilter`/`setPaymentTypeFilter` saíram; a busca por texto, o seletor de coluna de busca e a ordenação permanecem. O backend continua aceitando `paymentType` na query — apenas a UI deixou de enviá-lo.

### Tests
- Frontend: novos testes de capitalização dos cabeçalhos em `SearchSortComponents.test.jsx` (classe sem `uppercase` no `SortableHeader`) e em `OrdersPage.test.jsx`, `SalesPage.test.jsx`, `ProductsPage.test.jsx` e `StockPage.test.jsx` (tabelas e histórico), além de um teste das larguras de Descrição/Ações em `OrdersPage.test.jsx`; o teste do filtro de tipo de pagamento foi substituído por um que garante a ausência do select e por três testes de ordenação por `paymentType`/`doterraPv`/`totalValue` (`OrdersPage.test.jsx`), com os seletores `data-label="PV"` atualizados em `OrdersPayments.test.jsx`. **631 backend + 745 frontend tests passing**; lint sem erros (5 warnings preexistentes), `prettier --check` limpo nos arquivos alterados e `cd frontend && npm run build` limpo.

## Phase 85 — Remoção das colunas Status/Valor Pendente e do filtro de status em Pedidos dōTERRA (2026-09-12)

### Changed
- **Colunas "Status" e "Valor Pendente" removidas da lista de Pedidos dōTERRA** (`frontend/src/pages/Orders/components/OrdersTable.jsx`): cabeçalhos e células (desktop e cartões mobile) foram removidos e as larguras das colunas restantes reajustadas. Os dados continuam no banco e nos modais de detalhamento/pagamento; o status segue disponível via API (`GET /api/orders?status=...`).
- **Filtro de status removido da toolbar** (`frontend/src/pages/Orders/components/OrdersTableToolbar.jsx`): com a coluna de status fora, o select "Status" (`STATUS_FILTER_OPTIONS`) e o estado `statusFilter`/`setStatusFilter` saíram de `useOrderFilters.js`, `useOrders.js` e `index.jsx`; busca por texto, filtro de tipo de pagamento e ordenação permanecem. Pedidos da equipe passam a ser identificados pela ausência da ação de pagamento.

### Tests
- Frontend: testes que ancoravam as colunas removidas/status foram reescritos ou removidos em `frontend/tests/OrdersPage.test.jsx` e `frontend/tests/OrdersPayments.test.jsx`; o e2e `frontend/e2e/team-orders.spec.js` passa a validar o status `EQUIPE`/`PENDENTE` via API (`GET /api/orders?q=...`) em vez do filtro, e o teste do filtro "Somente da equipe" foi removido. **631 backend + 735 frontend tests passing**; lint sem erros (5 warnings preexistentes), `prettier --check` e `cd frontend && npm run build` limpos.

## Phase 84 — Placeholder para produtos sem preço na lista (2026-09-08)

### Fixed
- **Tela em branco ao filtrar produtos por nome**: produtos sem preço vigente (o backend projeta `regularPrice`/`memberPrice`/`pv` como `null` em `backend/src/utils/productsProjection.js`) quebravam o `formatBRL` (`frontend/src/utils/money.js`), que chamava `toLocaleString` sem guarda contra `null`. `formatBRL` agora devolve `—` para `null`/`undefined`/string vazia/`NaN`, e a tabela (`frontend/src/pages/Products/components/ProductsTable.jsx`) exibe `—` nas colunas Preço Regular, Preço Membro, PV e 70% OFF — a coluna 70% OFF mostrava `R$ 0,00` (enganoso) para preço de membro nulo em vez de quebrar.
- **Edição de produto sem preço mostrava "NaN"**: `openEditModal` (`frontend/src/pages/Products/useProducts.js`) fazia `String(parseFloat(null))`; valores nulos/inválidos agora viram campo vazio. `filterAndSortProducts` (`frontend/src/pages/Products/utils/productHelpers.js`) tolera `name`/`code` nulos, e "Copiar linha" usa `—` para preços/PV nulos.

### Tests
- Frontend: novo `frontend/tests/money.test.js` (`formatBRL` com valores válidos e placeholder para nulo/indefinido/`NaN`/vazio); dois testes novos em `frontend/tests/ProductsPage.test.jsx` (linha com preços nulos renderiza placeholders; filtro por nome com produto sem preço não quebra a página); um teste novo em `frontend/tests/productHelpers.test.js` ("Copiar linha" com preços nulos). **631 backend + 739 frontend tests passing**; lint sem erros (5 warnings preexistentes em Sales), `prettier --check` limpo nos arquivos alterados, `cd frontend && npm run build` limpo.

## Phase 83 — Documentação Swagger/OpenAPI completa do backend (2026-09-07)

### Added
- **Anotações `@openapi` em todas as rotas** (`backend/src/routes/*.js`) seguindo o modelo de `authRoutes.js` (`POST /api/auth/login`): `POST /api/auth/register`; 8 endpoints de `peopleRoutes.js` (lista com `q`/`classification`/`sortBy`/`sortDir`, por ID, `summary`, `purchases`, `self`, update, delete); 14 endpoints de `ordersRoutes.js` (CRUD, itens, `POST /:orderId/payments`, `PUT /payments/:id`, `GET /:orderId/balance`, anexo via `multipart/form-data` com campo `file` PNG/JPEG/WebP); 5 de `salesRoutes.js`; `GET /api/dashboard`; 5 de `productRoutes.js` (filtros `active`/`status`/`available`/`inStock`/`q`, paginação); 4 de `stockRoutes.js`. Rotas públicas usam `security: []`; as autenticadas herdam o `bearerAuth` global. Erros via `$ref` para as respostas reutilizáveis (`BadRequest`, `Unauthorized`, `NotFound`, nova `Conflict`).
- **`components.schemas` completos em `backend/src/docs/swagger.js`**: `LoginResponse` corrigido (`token` + `expiresIn`), `RegisterInput`/`RegisterResponse`, `Person` expandido + `PersonInput`/`PersonSummary`/`PersonPurchase`, `PaymentType`, `OrderInput`/`OrderUpdateInput`/`OrderItemInput`/`Order`, `Payment`/`PaymentInput`/`PaymentUpdateInput`/`PaymentResult`, `PersonBalance`/`OrderBalance`, `AttachmentResponse`, `SaleInput`/`SaleUpdateInput`/`SaleItemInput`, `DashboardSummary`, `ProductInput`/`ProductUpdateInput`/`Product`/`PaginatedProducts`/`Pagination`, `MovementInput`/`StockMovement`/`InventoryItem`/`MovementResult` e genérico `Message` — todos espelhando os validadores Zod e as projeções dos controllers.

### Tests
- Sem testes novos (mudança só de comentários/docs — o diff das rotas contém apenas blocos JSDoc, nenhuma lógica alterada). Verificação: spec gerada com 24 paths e 0 operações sem tag; smoke test via `curl` contra o backend (401 sem token, register/login com `token`/`expiresIn`, 200 em `people`/`products`/`sales`/`stock`/`dashboard`/`orders`, ciclo POST/summary/purchases/DELETE de pessoa, `/api/docs.json` com 24 paths e `/api/docs` 200); usuário de smoke removido do banco de dev. **631 backend + 734 frontend tests passing**; `npm run lint` e `format:check` limpos.

## Phase 82 — Lista de produtos comprados no detalhamento do cliente (2026-09-05)

### Added
- **Lista "Produtos comprados" no modal de detalhes do cliente**: o card do resumo financeiro virou um toggle clicável (chevron giratório, `aria-expanded`, testid `client-summary-toggle`); ao expandir, o modal busca o novo endpoint `GET /api/people/:id/purchases` (busca lazy, cacheada por cliente e revalidada ao trocar de pessoa) e exibe uma linha por item comprado — colunas Data (dd/mm/aaaa), Produto, Qtd e Total (BRL em centavos via `lineValueCents`), sem número de venda. Itens de pedidos `COMPRA` e `VENDA` aparecem em grupos separados ("Compras" e "Vendas", nesta ordem) e o título do grupo só aparece quando o cliente tem itens daquele tipo; sem itens, exibe "Nenhum produto comprado."
- **Endpoint `GET /api/people/:id/purchases`** (`backend/src/routes/peopleRoutes.js`, `backend/src/controllers/peopleController.js`): ownership check idêntico ao do summary (404 para pessoa inexistente ou de outro usuário), exclusão de pedidos de equipe (mesma regra do resumo), payload por linha com `orderId`, `orderType`, `orderDate`, `name` (`product.name` com fallback para a descrição do item), `quantity` e `totalCents`, ordenado por data do pedido desc e nome do produto asc em empates.
- **Navegação a partir da lista**: clicar no nome do produto abre a origem da compra — pedidos `COMPRA` navegam para `/orders?detailsOrder=<id>` (novo deep-link que abre o modal "Detalhamento" do pedido) e vendas `VENDA` navegam para `/sales?editSale=<id>` (deep-link já existente do formulário de vendas).

### Tests
- Backend: novo bloco `GET /api/people/:id/purchases` (`backend/tests/people.test.js`) cobrindo uma linha por item nos dois tipos de pedido (com shape exato do payload), modo UNIT × quantidade e TOTAL como valor cheio, fallback de nome para itens sem produto, exclusão de pedidos de equipe, lista vazia, ordenação (data desc, nome asc) e 404 de ownership/inexistência. **631 backend tests passing**.
- Frontend: novo bloco "purchased products" no describe do modal de detalhes (`frontend/tests/PeoplePage.test.jsx`) cobrindo toggle expande/recolhe sem refetch, grupos Compras/Vendas filtrados por tipo, estado vazio, erro de carregamento, reset do estado ao abrir outro cliente e navegação para `/orders?detailsOrder=` e `/sales?editSale=` (com probe de rota); deep-link `?detailsOrder` do Orders coberto em `OrdersPayments.test.jsx` (abre o detalhamento e não o formulário de edição). **734 frontend tests passing**; lint sem erros (5 warnings do padrão pré-existente), `npm run format:check` e `cd frontend && npm run build` limpos.


## Phase 81 — Cashback de 70% nos itens de venda e refinamentos da lista de vendas (2026-09-05)

### Added
- **Checkbox "O produto teve origem no cashback de 70%"** nos itens do formulário de venda: ao marcar, aparece o campo somente leitura "Valor Membro c/ 70% de desconto (total)" (total de membro × 0,30, via `memberCashbackLineTotal`/`CASHBACK_DISCOUNT_RATE` em `saleHelpers.js`); o campo "Valor Membro (total)" permanece sempre visível e o "Valor Cobrado" continua editável, sem prefill automático. O flag é persistido no `Item.useCashback` já existente (sem migração): `saleItemSchema` (`backend/src/validators/salesValidator.js`) aceita o boolean e `saleItemCreateData`/`saleItemUpdateData` (`backend/src/services/salesService.js`) persistem com default `false`.
- **Coluna "Recebido" na lista de vendas**: exibe o total pago com cor por situação — vermelho quando recebido < valor da venda, verde quando igual, azul quando recebido a mais (comparação em centavos via `getSaleFinancials` em `SalesTable.jsx`). Coluna não ordenável.

### Changed
- **Descrição da lista de vendas em uma linha**: a célula usa `truncate` (reticências) com o texto completo no `title` (hover), no padrão já usado na tabela de pedidos; a coluna foi alargada (18% → 23%) para maximizar o texto visível.
- **Tooltip de itens na célula "Cliente"**: o hover exibe os produtos e valores cobrados no formato "Produto (Cobrei R$ X)", itens unidos por " / " e sem separador para venda de item único (`getSaleClientTooltip` em `saleHelpers.js`; o valor é o total da linha respeitando o modo UNIT/TOTAL).
- **Colunas e busca da lista**: coluna "Nº Venda" removida (o número continua visível no modal de detalhamento e a busca "Todas as colunas" continua pesquisando pelo número no backend) e a opção "Número da venda" removida do seletor de busca (`SALE_SEARCH_FIELD_OPTIONS`).

### Tests
- Backend: `POST /api/sales` persiste `useCashback: true` e default `false` quando omitido; `PUT /api/sales/:id` alterna e reverte o flag de um item existente. **623 backend tests passing** (27 arquivos).
- Frontend: novo bloco "Sale item cashback" (checkbox desmarcado por default, exibição/ocultação do campo de 70%, escala com a quantidade, payload true/false, valor cobrado intocado ao alternar, edição reflete o flag salvo); lista sem coluna "Nº Venda" e sem a opção "Número da venda"; cores da coluna "Recebido" (menor/igual/maior) com fixture de overpayment; descrição truncada com `title`; tooltip do cliente com um e dois itens; testes que ancoravam linhas em "V-0001"/"V-0002" reescritos para os nomes dos clientes. **725 frontend tests passing** (26 arquivos); lint sem erros novos (4 warnings preexistentes), `npm run format:check` e `cd frontend && npm run build` limpos.


## Phase 80 — Valor Total, frete do próprio usuário e campo Pessoa só em pedidos da equipe (2026-09-05)

### Changed
- **"Soma dos Produtos (Valor Pago)" → "Valor Total"**: o formulário de pedidos ficou com um único bloco de totais (inferior, ao lado do campo Frete), renomeado para **Valor Total** e exibindo a soma dos produtos + o frete (testid `order-totals-charged-footer`). O bloco de resumo superior que repetia a "Soma dos Produtos" foi removido (`OrderForm.jsx`), seguindo o padrão do formulário de vendas.
- **Valor Pendente desconta o frete do próprio usuário**: a coluna "Valor Pendente" da lista (e os resumos dos modais de Pagamento/Detalhamento) trata o frete como custo do próprio usuário quando nenhum item do pedido está vinculado a outra pessoa — é o caso dos pedidos atuais (itens auto-vinculados ao "Você"), que passam a exibir R$ 0,00 e deixam de oferecer "Registrar Pagamento". Pedidos antigos com itens de outras pessoas mantêm o frete como pendente cobrável; nos registros legados o frete já foi rateado nos valores dos itens e `shippingValue` é 0, então nada muda para eles. A regra vive em `getOrderSelfShippingCents` (`frontend/src/pages/Orders/utils/receivablesHelpers.js`) e é espelhada na ordenação por pendente no backend (`backend/src/utils/ordersSort.js`).
- **Campo "Pessoa" por item apenas em pedidos da equipe**: o formulário de pedidos não exibe mais o campo de pessoa em pedidos normais — nem o seletor, nem o antigo campo somente leitura "Você"/nome legado (`OrderItemFields.jsx`). Ele reaparece ao marcar o checkbox "Pedido da equipe (outra pessoa fez o pedido e pagou)" e some ao desmarcar. Pedidos normais continuam nascendo vinculados ao usuário no backend, e a edição de pedidos antigos preserva o `personId` legado no payload.

### Fixed
- **Pedido all-self com frete exibia o frete como pendente**: p. ex. o pedido 123456789000 (total 35,74 = item 24,75 + frete 10,99, sem pagamentos) exibia "Valor Pendente R$ 10,99" embora já estivesse QUITADO; agora exibe R$ 0,00 (acinzentado, sem ação de pagamento). Nenhuma migração: os dados não mudam, apenas o cálculo de exibição/ordenação.

### Tests
- Backend: novo teste de ordenação `sortBy=pendingValue` (pedido all-self com frete 80,00 ordena como pendente 0 contra pedido misto com pendente 15,00). Frontend: rótulo "Valor Total" com bloco superior removido, total = produtos + frete no footer, pendente R$ 0,00 estilizado e sem ação de pagamento para all-self + frete, frete cobrável mantido em pedido misto (R$ 70,00), e campo "Pessoa" oculto em pedidos normais e exibido somente com o checkbox de equipe marcado (dois testes que garantiam o campo read-only foram reescritos). **621 backend + 714 frontend tests passing**; lint sem erros novos (4 warnings preexistentes), `npm run format:check` e `cd frontend && npm run build` limpos.


## Phase 79 — Correção do salvamento de pedido sem cliente e feedback de erro (2026-09-05)

### Fixed
- **Erro 400 "Person ID must be a valid UUID" ao salvar pedido**: itens criados pela tela de pedidos nascem com `personId: ''` (para pedidos normais a pessoa é o campo somente leitura "Você") e o schema Zod rejeitava a string vazia antes do vínculo automático com a pessoa do usuário. O `itemSchema` (`backend/src/validators/ordersValidator.js`) agora normaliza `personId: ''` para `null` — UUIDs genuinamente inválidos continuam rejeitados com 400 — e `itemPayload` (`frontend/src/pages/Orders/utils/orderHelpers.js`) envia `personId: null` em vez de string vazia. O item passa a ser vinculado à pessoa "Você" com `forStock`/`useCashback` preservados.
- **Tela em branco sem feedback quando o salvamento falha**: o `catch` do formulário passava `err.response.data.error` direto ao toast; para erros de validação Zod o backend devolve um **array de issues** (não string), que quebrava a renderização do React (sem ErrorBoundary o app inteiro desmontava). `formatToastMessage` (`frontend/src/components/Toast.jsx`) normaliza a mensagem antes de renderizar (string, array de issues Zod ou não-string), beneficiando todas as telas que usam `addToast`; a modal permanece aberta e o toast exibe a mensagem do backend.

### Tests
- Backend: novos testes em "Item cashback, person binding and stock defaults" (payload real da tela com `personId: ''`, `forStock` e `useCashback` vinculado ao self; UUID inválido continua rejeitado). Frontend: toast renderiza array de issues Zod e mensagem não-string sem quebrar a renderização (`Toast.test.jsx`); falha de salvamento em pedidos com erro Zod exibe toast legível com a modal aberta e a página interativa (`OrdersPage.test.jsx`); asserções de payload atualizadas para `personId: null`. **620 backend + 710 frontend tests passing**; lint sem erros novos (4 warnings preexistentes), `npm run format:check` e `cd frontend && npm run build` limpos.


## Phase 78 — Pedidos do próprio usuário, cashback 70% e Valor doTERRA derivado (2026-09-05)

### Added
- **Checkbox de cashback por item**: novo `Item.useCashback` (migração `20260905120000_add_item_use_cashback`, `BOOLEAN NOT NULL DEFAULT false`). No formulário de pedido, o checkbox "Usei pontos de cashback e ganhei 70% de desconto" preenche o campo **Valor Pago** com 30% do preço de membro quando marcado, ou com o preço de membro quando desmarcado; o valor recalcula sempre que o produto ou o checkbox mudam (`prefilledChargedValue`/`CASHBACK_DISCOUNT_RATE` em `frontend/src/pages/Orders/utils/orderHelpers.js`) e continua editável.
- **Vínculo automático dos itens ao usuário**: pedidos não-equipe deixam de exigir `personId` por item — o backend resolve o vínculo para a pessoa "Você" quando o campo é omitido (`resolveItemDefaults` em `backend/src/utils/ordersItemTransform.js`), preservando `personId`/`forStock` legados explicitamente informados para migração gradual. `forStock` passa a ter default `true` quando o item referencia um produto e está vinculado ao usuário; o checkbox continua disponível como override.
- **`doterraValue` derivado do total**: em todo create/update/addItem/updateItem/deleteItem o campo `Order.doterraValue` é gravado em silêncio igual a `totalValue` (soma dos produtos + frete), e o payload `doterraValue` é ignorado.

### Changed
- **"Valor Cobrado" renomeado para "Valor Pago"** em toda a UI de pedidos (campo do item, total da linha e "Soma dos Produtos (Valor Pago)"), mantendo o campo editável.
- **Seletor de pessoa por item só em pedidos da equipe**: pedidos normais exibem a pessoa como campo somente leitura ("Você" ou o nome legado), e o item nasce vinculado ao usuário; pedidos da equipe mantêm o seletor (quem do time fez o pedido).
- **Selecionar um produto marca "para meu estoque" automaticamente**; limpar o produto desmarca (não há o que estocar).

### Removed
- **Input "Valor doTERRA (R$)"** do formulário e **coluna "Valor doTERRA"** da tabela de pedidos (o valor agora sempre corresponde ao total, tornando a coluna redundante). A coluna no banco e os registros antigos são preservados; o campo `doterraValue` não é mais aceito/validado no payload.

### Tests
- Backend: novo bloco "Item cashback, person binding and stock defaults" (8 testes: vínculo ao self, preservação de pessoa legada, `useCashback` default/true, defaults de `forStock`); bloco doTERRA atualizado para o valor derivado (payload ignorado, sync com o total). **618 backend tests passing** (27 arquivos).
- Frontend: novos testes de prefill do Valor Pago (membro, 30% com cashback, recálculo ao trocar produto, edição manual, `useCashback` no payload), vínculo de pessoa (somente leitura em não-equipe; seletor e auto-criação do self em equipe), default de estoque ao selecionar produto; coluna/input "Valor doTERRA" removidos das expectativas. **707 frontend tests passing** (26 arquivos); lint sem erros novos (4 warnings preexistentes), `npm run format:check` e `cd frontend && npm run build` limpos.


## Phase 77 — Coluna "70% OFF" na tela de Produtos (2026-09-05)

### Added
- **Nova coluna "70% OFF" sempre ativa e ordenável** na tela de Produtos: exibe o valor resultante de um desconto de 70% sobre o preço de membro (ou seja, 30% do preço de membro). O cálculo é feito em centavos inteiros via `calculateDiscountedPrice` em `frontend/src/pages/Products/utils/productHelpers.js` (constante `MEMBER_DISCOUNT_PERCENT`) e a ordenação é suportada pelo campo computado `memberDiscountPrice`, tratado no sort de `filterAndSortProducts`.

### Removed
- **Coluna "PONTOS" e o botão de ligar/desligar coluna** removidos da tela de Produtos, junto com o seletor "Regularidade" e o texto explicativo de fidelidade. Código morto de fidelidade retirado de `productHelpers.js` (`LOYALTY_TIERS`, `LOYALTY_MINIMUM_PV`, `getLoyaltyTier`, `calculatePoints`, `formatPoints`, `isBelowMinimumPv`, `getLoyaltyTierDescription`). Estado/props `loyaltyTier`, `showPointsColumn` e `togglePointsColumn` removidos de `useProducts.js`, `index.jsx`, `ProductsTable.jsx` e `ProductsTableHeader.jsx`.

### Tests
- Novos testes para `calculateDiscountedPrice` (centavos, strings, arredondamento, valores nulos) e para a ordenação por `memberDiscountPrice` em `productHelpers.test.js`; novos testes da coluna "70% OFF" (sempre visível, valor correto, ordenação sem nova chamada de API) em `ProductsPage.test.jsx`; blocos de loyalty points removidos. **702 frontend tests passing**, lint sem erros novos (4 warnings preexistentes), `npm run format:check` e `cd frontend && npm run build` limpos.


## Phase 76 — SOLID, ESLint e migração do backend para ES Modules (2026-09-05)

### Added
- **Orientação SOLID documentada**: nova seção **Design Principles (SOLID)** no `AGENTS.md` definindo a adoção pragmática dos cinco princípios (aplicar quando agrega clareza/coesão/testabilidade; pular quando não há ganho; refatorar em direção ao princípio no momento da manutenção, escopado à mudança). Refletida nas skills: `backend-node-express` (SRP na camada Routes→Controllers→Services, DIP), `frontend-react` (SRP no page-as-orchestrator), `project-structure` e `implementation-style`.
- **ESLint 9 (flat config) nos dois workspaces**: `backend/eslint.config.js` (`@eslint/js` recommended + `globals.node`/`globals.vitest`) e `frontend/eslint.config.js` (React/react-hooks/jsx-a11y recommended + `globals.browser`/`globals.vitest`), ambos encerrando com `eslint-config-prettier` para não conflitar com o Prettier. Scripts `lint`/`lint:fix` por workspace e na raiz (`npm run lint`). `react-hooks/set-state-in-effect` desligada e `react-hooks/refs` como warning porque os hooks de página carregam dados em effects e mantêm um ref de callback mais recente (padrão existente); prefixo `^_` libera argumentos/variáveis/erros capturados intencionalmente não usados.

### Changed
- **Backend migrado de CommonJS para ES Modules**: `backend/package.json` ganhou `"type": "module"`; todos os `require()`/`module.exports` de `src/`, `tests/`, `scripts/loadProducts.js` e `prisma/seed.js` viraram `import`/`export`, com extensão `.js` explícita nos imports relativos e aliases de destructuring convertidos para `as` (ex. `createPayment as createPaymentService`). `src/config.js` agora exporta membros nomeados (`PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`). `__dirname` substituído por `fileURLToPath(import.meta.url)` em `middlewares/upload.js` e `scripts/loadProducts.js`; `dotenv` continua condicional (`NODE_ENV !== 'test'`) em `app.js`/`config.js`. Imports de controllers/services agora usam `import * as` onde o call-site usa `controller.metodo`.
- **Ajustes de lint (sem mudança de comportamento)**: parâmetros `err` não usados em catch renomeados para `_err`, variáveis não usadas removidas em testes (`os`, `authToken`, `testPersonId`, `order` órfão em `ordersAttachments.test.js`, `act`/`vi`/`React`/`api` não usados), `selectedBalance`/`editIsSelf` órfãos removidos de `useSalePayments.js`, directive `eslint-disable-next-line no-new` não usada removida de `productHelpers.js`, e `_api` mantido em `tests/api.test.js` (o import registra os interceptors via side-effect).

### Tests
- Suites intactas após a migração: **610 backend tests passing** (27 arquivos) e **701 frontend tests passing** (26 arquivos); `npm run lint` limpo (0 erros; 4 warnings preexistentes de `react-hooks`), `npm run format:check` limpo e `cd frontend && npm run build` ok.


## Phase 75 — Backend refactoring R1–R10 e ajustes de frontend (2026-09-05)

Consolidação da arquitetura do backend (`backend/docs/backend-refactoring-plan.md`, fases R1–R10) e correções de frontend. Exports e comportamento HTTP preservados em todas as fases.

### Added
- **Árvore backend alinhada ao guia de arquitetura**: controllers viraram thin handlers e a lógica migrou para novos módulos —
  - `validators/`: `authValidator` (R1), `stockValidator` (R4), `peopleValidator` (R5), `paymentsValidator` (R6), `productValidator` (R7), `salesValidator` (R8), `ordersValidator` (R9); schemas movidos verbatim (mensagens Zod inalteradas).
  - `services/`: `stockUndoService` (R4, regras de desfazer última movimentação + lock por pedido), `paymentsService` (R6), `kitValidationService` (R7), `salesService` (R8, com `nextSaleNumber` e retry P2002), `ordersService` + `orderStockIntegration` (R9, movimentações por item + reversões SAIDA).
  - `utils/`: `attachmentStorage` (R2), `orderBalances#buildOrderBalances` e `dashboardProjection#buildDashboardSummary` (R3), `classification` e `receivables.personFinancialSummary` (R5), `productsProjection`/`productSort`/`pagination` (R7), `salesHelpers` (R8), `ordersSort`, `ordersValidation`, `ordersItemTransform`, `ordersKitResolution`, `ordersStatusSync` (R9), `httpError` (R10).
- **Erros HTTP centralizados (R10)**: novo `backend/src/utils/httpError.js` (`badRequest`, `notFound`, `forbidden` — factories puras de `Error` com `.status`) e `backend/src/middlewares/errorResponse.js` (`handleError(res, error, { fallback, label })`): ZodError → 400 `{error: errors}`, erros com `.status` → status + `{error: message}` (inclui os extras `orderNumber`/`orderId` do bloqueio de undo), inesperado → `console.error` + fallback (500; 400 em payments/stock). Catches dos controllers viraram uma linha; guards inline (`not found`, checagens de quantidade do estoque, anexos) agora lançam pelos mesmos helpers.
- **Singleton do Prisma (R10)**: os 8 controllers que instanciavam `new PrismaClient()` passaram a reutilizar `backend/src/config/database.js` — um único pool de conexões.
- **Fechamento educado na criação (frontend)**: "Nova Venda" e "Novo Pedido" capturam snapshot do formulário ao abrir o modal, então Escape/backdrop/×/Cancelar com alterações mostram o ConfirmDialog "Descartar alterações?" em vez de descartar silenciosamente o que foi digitado.

### Changed
- Renome `StockController.js` → `stockController.js` (R4). Controllers encolheram: `peopleController` 349→259, `paymentsController` 291→134, `productController` 542→365, `salesController` 839→111, `ordersController` 1403→~195, `stockController` 288→174 linhas.
- `salesService` abandonou o `badRequest` privado (que lançava internamente) em favor do helper compartilhado, com `throw` explícito nos 12 call sites (R10).
- `ARCHITECTURE.md`: árvore de repositório e decisões de design atualizadas (services/validators, `httpError`/`errorResponse`, `ordersService`/`salesService` como consumidores de `applyMovement`).

### Removed
- `ordersHelpers.js` dividido em três módulos de responsabilidade única (`ordersValidation`, `ordersItemTransform`, `ordersKitResolution`); código morto removido (`statusItemFromItem`, export `orderDescriptiveSchema`) e o re-export `removeAttachmentFile` de `orderAttachmentsController` retirado (R9 follow-up).

### Fixed
- 4 testes frontend quebrados pelo renome "Gestão de Pedidos" → "Pedidos dōTERRA" (commit 8d42924): asserções em `OrdersPage.test.jsx`, `OrdersPayments.test.jsx`, `Header.test.jsx`, `MobileDrawer.test.jsx` e esperas no spec e2e `team-orders.spec.js`.

### Tests
- Novos arquivos (TDD): `orderBalances.test.js` (10), `dashboardProjection.test.js` (10), `stockUndoService.test.js` (9), `pagination.test.js` (14), `productSort.test.js` (9), `productsProjection.test.js` (11), `kitValidationService.test.js` (10), `httpError.test.js` (4), `errorResponse.test.js` (8) e o bloco `personFinancialSummary` em `receivables.test.js` (7); +16 testes de polite close no frontend (`SalesPage.test.jsx`/`OrdersPage.test.jsx`).
- **610 backend tests passing** (27 arquivos) e **701 frontend tests passing** (26 arquivos); `npm run format:check` e `cd frontend && npm run build` limpos.


## Phase 74 — Checkbox "Esta pessoa sou eu" dinâmico (2026-08-30)

### Changed
- **Checkbox "Esta pessoa sou eu" dinâmico**: o campo só é exibido quando ainda não existe um cliente marcado como a própria pessoa (`Person.isSelf`). No modal de novo cliente, ele desaparece assim que um cliente self já existe; no de edição, continua aparecendo apenas para o próprio cliente self (marcado, permitindo desmarcar o flag) e some para os demais clientes. `usePeople.js` expõe `hasSelfPerson` (calculado sobre a lista completa, não a filtrada) e os formulários recebem `showSelfCheckbox` via `PersonForm`/`PersonFormFields` (`frontend/src/pages/People/index.jsx`, `components/PersonForm.jsx`, `components/PersonFormFields.jsx`, `usePeople.js`).

### Tests
- Frontend: `PeoplePage.test.jsx` (+4 — checkbox oculto no novo cliente quando já existe um self; oculto ao editar um não-self com self existente; visível e marcado ao editar o próprio self; visível e desmarcado quando não há self). **685 frontend passing** (was 681). `npm run build` e `npm run format:check` limpos.

## Phase 73 — Campo Equipe em clientes e ajustes de listas e formulários (2026-08-30)

### Added
- **Campo "Equipe" em clientes**: novo `Person.isTeamMember` (migração `20260830120000_add_person_team_member`, `BOOLEAN NOT NULL DEFAULT false`) para marcar clientes que fazem parte da equipe do usuário. Puramente informativo — não afeta pedidos, dashboard nem financeiro. O formulário ganhou o select Sim/Não "Equipe", a lista ganhou a coluna ordenável "Equipe" (badge Sim/Não, larguras rebalanceadas: Grupos em Comum 17→15, Observação 22→17 para caber a coluna de 7%), o modal de detalhes ganhou a linha e o filtro de classificação ganhou a opção "Somente Equipe" (`classification=team` no backend mapeia para `isTeamMember`). A exportação Excel da aba Clientes inclui a coluna "Equipe".
- **Cabeçalhos ordenáveis na lista de produtos**: as colunas Código, Produto, Tamanho, Preço Regular, Preço Membro, PV e R$/PV são agora botões de ordenação clicáveis via `SortableHeader`, substituindo o dropdown "Ordenar por". `filterAndSortProducts` passa a receber `sortBy` + `sortDir` com allowlist (`SORTABLE_FIELDS`); novo `ProductsTableHeader.jsx` (extração Level 2) mantém `ProductsTable` abaixo do limite de revisão.
- **Filtro "Aniversariantes do mês"**: botão de alternância ao lado de "Novo" (ícone `Cake`, `aria-pressed`) que filtra a lista para clientes cujo mês do aniversário é o atual, combinando com a busca e a classificação; `birthMonthOf` virou a fonte única usada tanto pelo destaque da linha quanto pelo filtro (`filterAndSortPeople` ganhou `birthdayOnly` + mês corrente).

### Changed
- **Ordenação da lista de clientes**: os cabeçalhos WhatsApp, Instagram e Aniversário deixaram de ser ordenáveis (viraram `<th>` simples); "Aniversário" agora é Title Case. Padronização de caixa de "Aniversário", "Observação" e "Ações" (apenas a primeira letra maiúscula) em cabeçalhos desktop e `data-label` mobile.
- **Ordenação da lista de pedidos**: as colunas Pagamento, PV doTERRA, Valor doTERRA, Valor (R$) e Descrição deixaram de ser ordenáveis (mantidas Número, Data, Conta ID, Valor Pendente e Status).
- **Largura do layout**: o container principal (`App.jsx`) e o cabeçalho (`Header.jsx`) passaram de `max-w-7xl` para `max-w-screen-2xl` para melhor aproveitamento das tabelas largas.
- **Lista de produtos da Nova Venda**: passa a oferecer apenas produtos que existem no estoque do usuário (novo filtro `inStock=true` em `GET /api/products`; o formulário de vendas usa `available=true&inStock=true`), em vez de todo o catálogo.
- **Máscara monetária ATM em todos os campos de valor**: via `react-number-format`, o usuário digita só dígitos e os dois últimos são centavos (`"1234"` → `12,34`); dígitos não numéricos são descartados e o input é limitado a 10 dígitos (máx. `99.999.999,99`, limite do Prisma `Decimal(10,2)`). Novo `CurrencyInput.jsx` + `utils/currencyMask.js`; 11 campos monetários em Orders, Sales e Products trocados para a máscara; dígito de negativo não é mais digitável na UI (validações frontend/backend mantidas). Nova dependência `react-number-format@^5.4.5`.

### Tests
- Backend: `people.test.js` (+5 — criação com `isTeamMember`, default false, rejeição de não-booleano, toggle na edição, ordenação e filtro `classification=team`). **518 backend passing** (was 513).
- Frontend: `peopleHelpers.test.js` (+7 — `emptyForm`/`buildPayload`, opção "Somente Equipe", classificação e ordenação por `isTeamMember`), `PeoplePage.test.jsx` (+2 — filtro Equipe e ordenação pela coluna; também cria/edita payload, pré-preenchimento do select, badges, modal de detalhes), `exportExcel.test.js` (coluna Equipe no sheet Clientes), `productHelpers.test.js` (+7 — `filterAndSortProducts`) e `ProductsPage.test.jsx` (ordenação por cabeçalho). **681 frontend passing** (was 662). `npm run build` e `npm run format:check` limpos.

## Phase 72 — Pedidos de Venda (2026-08-30)

### Added
- **Pedidos de venda (sale orders)**: novo recurso para vender produtos do próprio estoque a um cliente. `Order.orderType` (`COMPRA`/`VENDA`), `Order.deliveredAt` (nullable), `Order.additionalValue` (default 0, somado ao `totalValue` e à regra de `QUITADO` junto com o frete), modelo `SaleCounter` (numeração sequencial `V-0001`, `V-0002`… por usuário, com `upsert` atômico e retry em `P2002`) — migração `20260830181046_add_sale_orders_and_payment_type`.
- **Endpoints `/api/sales`**: `GET/POST /api/sales`, `GET/PUT/DELETE /api/sales/:id` (`backend/src/controllers/salesController.js`, `backend/src/routes/salesRoutes.js`). Cliente fixo no nível do pedido (`clientPersonId`, não-self, injetado nos itens pelo controller); produto do catálogo obrigatório por item; `validateSaleProducts` (ATIVO/INDISPONIVEL); `resolveSaleKitFields`/`resolveSaleUpdateItems` congelam `kitSnapshot` e exigem `kitStockMode` para KIT; `PUT` sincroniza itens **por id**; `GET` suporta `q` + `searchField` (`all`/`orderNumber`/`client`/`description`), `status`, `delivered` e `sortBy` (inclui computados `pendingValue`/`clientName`).
- **Estoque de venda (semântica invertida)**: criação escreve **SAIDA** por item (kits expandidos via `expandSaleItemToStockProducts`, motivo `Venda V-XXXX`, `effectiveDate = orderDate`); edição aplica o delta líquido (`computeSaleStockDiff`: delta > 0 = SAIDA, delta < 0 = ENTRADA); exclusão reverte com **ENTRADA**. Estoque insuficiente bloqueia com `400 Estoque insuficiente para {nome}: disponível X, necessário Y` (`backend/src/services/stockService.js`).
- **Pagamento por pagamento**: `Payment.paymentType` (nullable enum `PIX`/`BOLETO`/`CARTAO_CREDITO`/`INFINITE_PAY`, schema Zod compartilhado em `backend/src/utils/paymentTypes.js`) em todos os recebimentos (compras e vendas). Modais de pagamento/edição de Orders e Sales ganharam o select "Forma de Pagamento" (opção "Não informada") e os detalhamentos mostram um badge por pagamento (`payment-badge-<id>`).
- **Página Vendas no frontend**: rota `/sales`, itens de navegação "Vendas" em `Header.jsx`/`MobileDrawer.jsx`, página Level 3 em `src/pages/Sales/` (`useSales`, `useSaleFilters`, `useSalePayments`, componentes `SalesTable`/`SalesTableToolbar`/`SaleForm`/`SaleItemFields`/`SaleTotals`/`SaleBadges`/`SalePaymentModal`/`SaleDetailsModal`/`SaleEditPaymentModal`, `utils/saleHelpers.js`). Formulário com Cliente (não-self), Data do Pedido, Frete, Valores Adicionais, Descrição e Data de entrega (sem campos de compra); tabela com Nº Venda, Data, Cliente, Valor, Pendente, badge de Entrega ("Pendente de entrega"/"Entregue + data"), Descrição, Status e Ações ("Registrar Pagamento"/"Dar baixa", "Detalhar Pagamentos", "Marcar como entregue"/"Desmarcar entrega", Editar, Excluir). Pagamentos reutilizam os endpoints de `/orders` com cliente fixo. Deep-link `/sales?editSale=<id>`.
- **Vendas no histórico de estoque e na exportação**: `HistoryDialog`/`Stock/index.jsx` mostram badge `Venda V-XXXX` e deep-link `/sales?editSale=<id>` quando `movement.order.orderType === 'VENDA'` (compras seguem `/orders?editOrder=<id>`); `StockController.getProductHistory` inclui `orderType` e o rótulo do undo usa "Venda" vs "Pedido". `exportExcel` ganhou entrada `sales`: nova aba **Vendas** e o **Histórico de Pagamentos** consolida compras + vendas; o dashboard exporta `GET /api/sales`.

### Changed
- `GET /api/orders` agora retorna apenas `orderType COMPRA`; `updateOrder`/`deleteOrder`/`addItemToOrder`/`updateItem`/`deleteItem` rejeitam pedidos `VENDA` com `400 use os endpoints de vendas (/api/sales)`; anexos tratam vendas como 404.
- `computeOrderStatus` recebeu `additionalCents` (`QUITADO` = pagamentos ≥ itens + frete + adicionais) e o dashboard já inclui as vendas nos recebíveis.
- `paymentsController` aceita `paymentType` opcional/nullable no create/update.

### Tests
- Backend: novos `tests/sales.test.js` (35), `tests/salesStock.test.js` (18), `tests/salesPayments.test.js` (12); ajustes em `payments.test.js` (paymentType), `dashboard.test.js` (inclusão de vendas), `ordersStock.test.js`/`stock.test.js` (mensagem `Estoque insuficiente`). **510 backend passing** (was 436).
- Frontend: novos `tests/SalesPage.test.jsx` (44) e `tests/SalesPayments.test.jsx` (16); cobertura de forma de pagamento em `OrdersPayments.test.jsx`; link "Vendas" em `Header.test.jsx`/`MobileDrawer.test.jsx`; badge/link de venda em `StockPage.test.jsx`; vendas na exportação em `exportExcel.test.js`/`DashboardPage.test.jsx`. **625 frontend passing** (was 550).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 71 — Aniversário do cliente, colunas da lista e detalhamento (2026-08-30)

### Added
- **Aniversário (dia/mês) do cliente**: novo campo opcional `Person.birthday` (string `"DD/MM"`, sem ano, `VARCHAR(5)`, migração `20260830110000_add_person_birthday`) validado no Zod de `backend/src/controllers/peopleController.js` (dia/mês real; `31/02` rejeitado, `29/02` aceito pois o ano é desconhecido). No formulário da página Clientes, input com máscara automática `DD/MM` (`maskBirthday` em `frontend/src/pages/People/utils/peopleHelpers.js`) e validação no submit (`usePeople.js`); pré-preenchido na edição.
- **Coluna "Aniversário" na listagem**: exibe o `DD/MM`; quando o mês atual é o do aniversário, a **linha inteira** ganha destaque âmbar (`bg-amber-50 dark:bg-amber-900/20`) e a data fica destacada em âmbar.
- **Detalhamento do cliente**: nova ação "Detalhes" (primeira) no menu de ações da linha, abrindo `ClientDetailsModal.jsx` com todos os dados cadastrados (nome, grupos em comum, aniversário, endereço, WhatsApp/Instagram clicáveis, observação, VIP, membro doTERRA) e o **resumo financeiro** do cliente: nº de pedidos, total dos itens, total pago e total em aberto.
- **Resumo financeiro por cliente**: novo endpoint `GET /api/people/:id/summary` (com checagem de ownership) retornando `ordersCount`, `totalItemsCents`, `totalPaidCents` e `totalOpenCents` em centavos inteiros (`lineValueCents`/`toCents`). Exclui pedidos de equipe; `totalOpenCents` é 0 para pessoas "self" e é limitado a 0 quando o pago supera o valor dos itens.
- **Ícones de marca (react-icons)**: nova dependência `react-icons` (v5.7.0) para os ícones de WhatsApp (`SiWhatsapp`) e Instagram (`SiInstagram`) na listagem e no detalhamento.

### Changed
- **Colunas da lista de clientes**: agora `Nome | Grupos em Comum | WhatsApp | Instagram | Aniversário | Observação | VIP | Membro doTERRA | Ações`. A coluna **Endereço foi removida** da tabela (mantida no formulário e no detalhamento); WhatsApp e Instagram passam a exibir apenas o ícone (link mantido, número/URL preservados em `title`/`aria-label`); "Grupos em Comum" ganhou mais largura e "Ações" foi reduzida.
- **Modal de detalhamento ampliado**: largura aumentada de `max-w-lg` para `max-w-3xl` para exibir textos longos (ex.: observação) por completo, com `break-words` e rolagem interna.

### Tests
- Backend: `tests/people.test.js` (+17: criação/atualização com `birthday`, inválidos `31/02`, `01/13`, `00/05` e formato errado, `29/02` aceito, default `null`; resumo com zeros, totais em centavos, qty e modo `TOTAL`, exclusão de pedidos de equipe, overpayment, pessoa "self", 404 por ownership/inexistente). **436 backend passing** (was 419).
- Frontend: `PeoplePage.test.jsx` (+9: campo aniversário e máscara, validação de data inválida, colunas com ícones de marca, ausência da coluna Endereço, destaque da linha no mês, modal de detalhes com resumo financeiro e links WhatsApp/Instagram). **550 frontend passing** (was 541).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 70 — Expansão da visualização do anexo (2026-08-30)

### Added
- **Botão "Expandir/Reduzir" no modal de anexo**: em `frontend/src/pages/Orders/components/AttachmentPreviewModal.jsx`, quando a imagem do anexo é carregada, um botão ("Expandir" com ícone `Maximize2`, alternando para "Reduzir" com `Minimize2`) amplia a visualização: o modal alarga de `max-w-2xl` para `max-w-[95vw]` e a imagem passa de `max-h-[70vh]` para `w-full max-h-[85vh] object-contain`, permitindo inspecionar mais detalhes do print do pedido. O botão expõe `aria-pressed` e `data-testid="attachment-preview-expand"`.

### Tests
- Frontend: novo caso em `frontend/tests/OrdersPage.test.jsx` cobrindo a alternância completa (normal → expandido → normal) via `aria-pressed` e classes da imagem. **541 frontend passing** (was 540).
- Verified: `cd frontend && npm run build` clean, `npm run format:check` clean.


## Phase 69 — Campos doTERRA, InfinitePay e anexo de pedidos (2026-08-30)

### Added
- **Tipo de pagamento InfinitePay**: novo valor `INFINITE_PAY` no enum Prisma `PaymentType`, no Zod `paymentTypeSchema` de `ordersController.js`, no seletor do formulário ("InfinitePay"), no filtro de pagamento da listagem e no badge (rosa) — sincronizado entre os dois lados conforme a regra do `AGENTS.md`.
- **PV doTERRA e Valor doTERRA no pedido**: novos campos `Order.doterraPv` e `Order.doterraValue` (`Decimal(10,2)`, anuláveis, migração `20260830100000_add_doterra_fields_and_infinite_pay`), inicializados vazios e preenchidos pelo usuário no formulário, com validação de valor negativo. O **Valor doTERRA é apenas informativo**: não entra em `totalValue`, saldo pendente nem status. Ambos viram colunas ordenáveis na listagem.
- **Anexo do pedido (print doTERRA)**: upload de imagem por pedido armazenado em `backend/uploads/orders/` (gitignored, persistido no host via bind-mount do compose; `ATTACHMENTS_DIR` como override usado nos testes). Upload validado via `multer` (`backend/src/middlewares/upload.js`) — somente PNG/JPEG/WebP, nome de arquivo sempre UUID + extensão de whitelist (sem entrada do cliente em `path.join`), tamanho limitado por requisição (`ATTACHMENT_MAX_BYTES`, default 10 MB). Endpoints autenticados: `POST /api/orders/:id/attachment` (enviar/substituir), `GET /api/orders/:id/attachment` (streaming só após checagem de ownership) e `DELETE /api/orders/:id/attachment`; excluir o pedido também remove o arquivo.
- **UI de anexo**: no formulário, input de arquivo com pré-visualização; na edição, indicação de "Anexo existente" com opção de remover ou substituir. Na listagem, ação "Visualizar Anexo" no menu da linha (somente quando há anexo) abre modal somente-leitura (`AttachmentPreviewModal.jsx`) que busca a imagem como blob via instância autenticada e exibe via object URL.

### Changed
- **PV por item removido**: o campo PV saiu do item (formulário, payload, helpers) e a coluna `Item.pv` foi dropada na migração. A coluna "PV Total" (soma de itens), os resumos "Soma dos PV" e o sort computado `totalPv` foram substituídos pelo `Order.doterraPv` (sort direto na coluna). `effectivePvCents` removido de `backend/src/utils/money.js` e `frontend/src/pages/Orders/utils/orderHelpers.js` (`effectivePv.test.js` removido). O PV do catálogo de produtos (`ProductPrice.pv`) permanece intacto.
- **Listagem reorganizada**: colunas agora `Número | Data | Conta ID | Pagamento | PV doTERRA | Valor doTERRA | Valor (R$) | Valor Pendente | Descrição | Status | Ações`, com larguras rebalanceadas e `data-label` mobile atualizados.
- **Descrição com mais espaço**: largura da coluna aumentada para ~16% e exibição em até 2 linhas (`line-clamp-2`) mantendo o `title` com o texto completo.
- **"Responsável" → "Conta ID"**: renomeado no cabeçalho da lista, no formulário ("Conta ID (ID dōTERRA ou nome)"), na opção do seletor de busca e nos modais de pagamento/detalhes; cabeçalho "Tipo Pgto" → "Pagamento".

### Fixed
- **Anexo falhando com "No file provided"**: a instância do axios (`frontend/src/services/api.js`) definia `Content-Type: application/json` como padrão, e o axios 1.16 serializa `FormData` para JSON nesse caso (nenhum arquivo chega ao multer). O interceptor de request agora remove o `Content-Type` quando o payload é `FormData`, deixando o navegador montar o body multipart com o boundary correto — anexo funciona na inclusão e na edição.

### Tests
- Backend: `tests/orders.test.js` atualizado (loop de tipos com `INFINITE_PAY`, campos doTERRA com create/update/clear/null e sort por `doterraPv`, remoção do `pv` de item), novo `tests/ordersAttachments.test.js` (14 casos: upload, substituição com limpeza do arquivo antigo, get com bytes/content-type, delete, 404 por ownership/inexistente, tipo inválido, tamanho excedido, limpeza ao excluir pedido). **419 backend passing** (was 403).
- Frontend: `OrdersPage.test.jsx` e `OrdersPayments.test.jsx` atualizados (colunas novas, InfinitePay, campos doTERRA, remoção do PV de item, fluxo de anexo, "Conta ID"); `api.test.js` +3 (regressão do interceptor FormData); polyfill de `URL.createObjectURL` em `tests/setup.js`. **540 frontend passing** (was 523).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.


## Phase 68 — Ajustes visuais no fluxo de pedidos da equipe (2026-08-24)

### Changed
- **Indentação do aviso do toggle de equipe**: em `frontend/src/pages/Orders/components/OrderForm.jsx`, o parágrafo "Este pedido é apenas um registro…" ganhou `ml-7`, alinhando-o com o texto do checkbox em vez de começar colado na caixa de seleção.
- **Cor neutra no valor de pedidos da equipe**: em `frontend/src/pages/Orders/components/OrdersTable.jsx`, a coluna "Valor (R$)" de pedidos com `isTeamOrder` agora usa `text-gray-400 dark:text-gray-500` (mesma cor do placeholder "—"), sinalizando que o valor é apenas o total do registro e não um valor a receber.

### Tests
- Frontend: **523 passing** (sem novos testes — mudanças exclusivamente visuais, cobertas pela suíte existente). Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.

## Phase 67 — Pedidos da equipe com status EQUIPE (2026-08-24)

### Added
- **Pedidos da equipe (status `EQUIPE`)**: novo tipo de pedido para registrar situações em que outra pessoa da equipe fez o pedido e pagou por conta própria. Marcado por `Order.isTeamOrder` (migração `20260824164617_add_team_order`), o pedido é apenas um registro: não entra no controle de recebimento, nos gastos do usuário nem no estoque.
- **Status dedicado `EQUIPE`**: `computeOrderStatus` retorna sempre `EQUIPE` para pedidos com `isTeamOrder` (nunca `PENDENTE`/`PARCIAL`/`QUITADO`), cobrindo todos os pontos que recomputam status (criar/editar pedido e item, sincronização). Alternar o pedido de volta para normal recomputa o status padrão.
- **Exclusão do dashboard**: `GET /api/dashboard` filtra `isTeamOrder: false`, excluindo os pedidos da equipe de `totalPending`, `totalPaid`, `currentMonthReceipts`, `personBalances` e `yearlyBreakdown` (pagamentos dos membros não contam como recebimento).
- **Sem estoque e sem pagamentos**: pedidos da equipe não geram movimentações de estoque (mesmo com itens self + `forStock`; a opção "para meu estoque" é ocultada no formulário) e rejeitam `POST`/`PUT` de pagamentos (400 "Pedidos da equipe não aceitam pagamentos").
- **UI**: toggle "Pedido da equipe (outra pessoa fez o pedido e pagou)" no formulário com aviso explicativo; badge roxo "Equipe" na listagem; coluna "Valor Pendente" exibida como "—"; ação "Registrar Pagamento" oculta; novo filtro de status "Somente da equipe".
- **Suíte e2e Playwright** (`frontend/e2e/`, `frontend/playwright.config.js`): 5 casos cobrindo criar pedido da equipe pelo formulário, filtro "Somente da equipe", detalhamento somente-leitura, exclusão do dashboard e alternância para pedido normal; dependência `@playwright/test` e scripts `test:e2e`/`test:e2e:headed`.

### Changed
- `backend/src/utils/receivables.js`: `computeOrderStatus` aceita `isTeamOrder` e retorna `EQUIPE`; `syncOrderStatuses` repassa o flag.
- `backend/src/controllers/ordersController.js`: schema aceita `isTeamOrder`; criação/edição pulam a validação de item de estoque, as movimentações e o diff de estoque em pedidos da equipe; `pendingCents` de ordenação = 0.
- `backend/src/controllers/paymentsController.js`: rejeita criar/editar pagamento em pedido da equipe.
- `backend/src/controllers/dashboardController.js`: o `where` adiciona `isTeamOrder: false`.
- Frontend: `useOrders.js` (estado/payload `isTeamOrder`), `OrderForm.jsx` (toggle + aviso), `OrderItemFields.jsx` (oculta "para meu estoque"), `Badges.jsx` (config `EQUIPE`), `OrdersTable.jsx` (pendente "—"), `orderHelpers.js` (filtro "Somente da equipe") e `receivablesHelpers.js` (pendente 0 e ação de pagamento oculta).
- `frontend/vitest.config.js` exclui `e2e/**` do Vitest; `.gitignore`/`.prettierignore` ignoram `test-results/`, `playwright-report/` e `e2e/screenshots/`.
- `ARCHITECTURE.md` e `AGENTS.md` documentam o status `EQUIPE` e a regra de exclusão do dashboard.

### Tests
- Backend: `tests/receivables.test.js` (+2 — `EQUIPE` com `isTeamOrder`), `tests/orders.test.js` (+5 — criação, default, toggle, notas, sem estoque e valor inválido), `tests/payments.test.js` (+1 — rejeição de pagamento), `tests/dashboard.test.js` (+4 — exclusão de todas as métricas). **403 backend passing** (was 390).
- Frontend: `tests/OrdersPage.test.jsx` (+2 — payload `isTeamOrder` e aviso) e `tests/OrdersPayments.test.jsx` (+1 — badge Equipe, pendente "—" e ação de pagamento oculta). **523 frontend passing** (was 520).
- e2e: `frontend/e2e/team-orders.spec.js` — **5 casos Playwright passing** (usuário dedicado `e2e_team_*`, registros mantidos na base).
- Verified: `npm run format:check` clean, `cd frontend && npm run build` clean.

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

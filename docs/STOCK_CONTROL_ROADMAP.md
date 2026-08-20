# Plano de Implementação: Controle de Estoque

> Documento operacional para execução fase a fase por agentes de IA.
> **Regra de ouro:** cada agente executa **apenas uma fase** por vez, preenche o
> bloco de handoff no **Log de Progresso** ao final, e para.

---

## 1. Visão Geral

Adiciona uma funcionalidade **nova e isolada** de controle de estoque ao sistema.
São criadas duas tabelas (`Inventory` — saldo atual; `StockMovement` — histórico),
uma área de API `/api/stock`, e uma página `Stock` no frontend.

**Princípio de isolamento (crítico):** não tocar em **nenhuma linha** dos
controllers/routes de `Orders`, `Payments` ou `Products`. O estoque é lançado de
forma **manual** nesta versão. A integração automática com pedidos é trabalho
futuro (ver seção _Preparação para o Futuro_).

### Escopo resumido

| Fase | Entrega | Diretórios afetados |
| ---- | ------- | ------------------- |
| 1 | Banco de dados (Prisma) | `backend/prisma/` |
| 2 | Backend (Node/Express/Prisma) + testes | `backend/src/`, `backend/tests/` |
| 3 | Frontend (React/Tailwind/Flowbite) + testes | `frontend/src/`, `frontend/tests/` |

---

## 2. Princípios e Regras Invioláveis

Reprodução dos pontos do `AGENTS.md` que tocam diretamente este recurso. **Leia o
`AGENTS.md` e o `ARCHITECTURE.md` antes de iniciar qualquer fase.**

- **Isolamento de dados:** todo `Inventory` e `StockMovement` é escopado por
  `req.user.userId`. Nunca expor ou gravar dados de outro usuário.
- **TDD:** escrever os testos **antes** da lógica de negócio (dentro de cada fase).
  Cobrir validação, casos de borda, autorização e consistência transacional.
- **Quantidade é inteiro:** `quantity` é `Int` em Prisma e inteiro em toda a
  camada de aplicação. Não usar ponto flutuante para quantidade.
- **Consistência transacional:** a criação de movimento e o upsert de `Inventory`
  devem ocorrer em **um único `prisma.$transaction`**.
- **Sem regressões:** a suíte existente (168 backend + 321 frontend) deve
  continuar passando após cada fase.
- **Migrations com dados:** usar `npx prisma migrate dev` somente em banco vazio
  de desenvolvimento. Em banco com dados, usar `npx prisma migrate deploy`. Nunca
  `prisma migrate dev` em banco populado. Após mudanças de schema, rodar
  `npx prisma generate` no ambiente que roda os testes.
- **z-index:** navegação `z-50`, modais `z-[60]`, confirmações `z-[70]`, menus de
  ação (kebab) `z-[80]`.
- **Mocks Vitest são hoisted:** usar factories com arrow wrappers lazy e
  `vi.hoisted()` quando o módulo invoca o mock durante a avaliação.
- **jsdom:** em testes de formulário com campos obrigatórios, usar
  `fireEvent.submit(form)`.
- **Backend Vitest serial:** manter `fileParallelism: false` (os arquivos de
  teste compartilham um banco).
- **Documentação:** não editar `CHANGELOG.md` até o usuário confirmar que não há
  mais ajustes. Usar `NOTES.md` para notas intermediárias (ver _Protocolo de
  Finalização_).

---

## 3. Convenções do Projeto (referências rápidas)

- Tech stack: Node/Express/Prisma/Zod/JWT (backend); React 18/Vite/Tailwind
  3 + plugin Flowbite/Recharts/SheetJS/lucide-react (frontend); PostgreSQL 15.
- Backend: `backend/src/app.js` monta rotas em `/api/<area>`; controllers em
  `backend/src/controllers/`; rotas em `backend/src/routes/`; auth middleware
  `backend/src/middlewares/auth.js` (`authenticateToken`); Prisma client em
  `backend/src/config/database.js`.
- Frontend: `frontend/src/services/api.js` exporta a instância axios (baseURL
  `/api` com interceptor que anexa o JWT). Páginas complexas seguem o padrão
  _page-as-orchestrator_: `frontend/src/pages/<Nome>/` com `index.jsx`
  (orquestrador), `use<Nome>.js` (hook), `components/` e `utils/`. O arquivo
  `frontend/src/pages/<Nome>Page.jsx` é um shim de uma linha
  (`export { default } from './<Nome>/index.jsx';`). Guia de referência:
  `frontend/docs/frontend-architecture-guide.md`.
- Componentes compartilhados: `frontend/src/components/ActionMenu.jsx` (kebab,
  `z-[80]`), `ConfirmDialog.jsx`, `Toast.jsx` (`useToast`).
- Nav: links em `navLinks`/`navItems` em `Header.jsx` e `MobileDrawer.jsx`.

---

## 4. Pré-requisitos (antes de iniciar a Fase 1)

1. Ambiente rodando: `docker compose up --build` (db, backend, frontend, Adminer).
2. Confirmar que a suíte atual passa:
   - `cd backend && npm run test`
   - `cd frontend && npm run test`
3. `git status` limpo (sem mudanças não commitadas que conflitem com o plano).
4. Ler `AGENTS.md`, `ARCHITECTURE.md`, `docs/data-model.md` e
   `frontend/docs/frontend-architecture-guide.md`.

---

## 5. Como usar este plano (protocolo de execução)

A cada fase, a instrução enviada ao agente deve seguir este modelo de prompt:

```text
Implemente APENAS a Fase <N> do plano em docs/STOCK_CONTROL_ROADMAP.md.
Regras: siga o TDD e as convenções do AGENTS.md; não implemente nada das
próximas fases; não toque em Orders/Payments/Products. Ao terminar, preencha
o bloco "Fase <N>" no "Log de Progresso" deste mesmo arquivo (status, arquivos
criados/alterados, testes adicionados com resultado da verificação, decisões,
bloqueios e ponto de partida do próximo agente) e encerre o turno.
```

Ao final de cada fase o agente **deve**:

1. Rodar as suítes completas (`npm run test` em `backend/` e `frontend/`) e, no
   caso da Fase 3, `npm run build` e `npm run format:check`.
2. Preencher o bloco de handoff correspondente no **Log de Progresso** (seção 11).
3. Parar. Não iniciar a próxima fase.

---

## 6. Fase 1 — Banco de Dados (Prisma)

### Objetivo
Criar as tabelas `Inventory` e `StockMovement` e o enum `StockMovementType`,
adicionar as relações em `User` e `Product` (somente os arrays de relação; nenhum
campo de negócio novo nesses modelos), gerar e aplicar a migration.

### Escopo
- `backend/prisma/schema.prisma`

### Tarefas
1. Adicionar o enum `StockMovementType` com valores `ENTRADA`, `SAIDA`, `AJUSTE`.
2. Adicionar o model `Inventory` (saldo atual) e `StockMovement` (histórico)
   conforme o schema abaixo.
3. Em `User`, adicionar `inventory Inventory[]` e `stockMovements StockMovement[]`.
4. Em `Product`, adicionar `inventory Inventory[]` e `stockMovements StockMovement[]`.
5. Gerar a migration e aplicar:
   - Dev/banco vazio: `npx prisma migrate dev --name create_inventory_tables`
   - Banco com dados: preparar a migration em ambiente limpo e aplicar com
     `npx prisma migrate deploy`.
6. Rodar `npx prisma generate` (necessário para que os testes/backend enxerguem
   os novos models).

### Schema de referência (adicionar ao `schema.prisma`)

```prisma
enum StockMovementType {
  ENTRADA
  SAIDA
  AJUSTE
}

model Inventory {
  id        String   @id @default(uuid())
  userId    String
  productId String
  quantity  Int      @default(0)

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, productId]) // 1 registro de saldo por produto por usuário
  @@index([userId])
}

model StockMovement {
  id          String            @id @default(uuid())
  userId      String
  productId   String
  quantity    Int               // Positivo para entrada/ajuste positivo; negativo para saída/ajuste negativo
  type        StockMovementType
  reason      String?           // Ex.: "Compra inicial", "Perda", "Uso pessoal"

  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  product     Product           @relation(fields: [productId], references: [id])

  createdAt   DateTime          @default(now())

  @@index([userId])
  @@index([productId])
}
```

> Em `User` e `Product`, adicionar **apenas**:
> ```prisma
> // em User
> inventory       Inventory[]
> stockMovements  StockMovement[]
> // em Product
> inventory       Inventory[]
> stockMovements  StockMovement[]
> ```

### Decisões a explicitar (decidir e registrar no handoff)
- **`onDelete` da FK `productId`:** `Product` é um catálogo global (não tem
  `userId`). Como `Inventory.productId` é obrigatório (não opcional), `SetNull`
  não é viável. Recomenda-se `onDelete: Restrict` para impedir apagar um produto
  que possui estoque (produtos são desativados, não apagados). Registrar a
  decisão final no handoff.
- Índices `@@index([userId])` e `@@index([productId])` para performance das
  listagens por usuário/produto (seguindo o padrão de `Item`).

### Critérios de aceitação (PT-BR)
- Migration `create_inventory_tables` criada e aplicada sem erro.
- `npx prisma generate` executado com sucesso.
- Tabelas `Inventory` e `StockMovement` visíveis no Adminer.
- `User` e `Product` expõem as novas relações sem alterar campos existentes.
- Suíte atual (backend + frontend) permanece 100% verde.

### Verificação
```bash
cd backend && npx prisma migrate dev --name create_inventory_tables
cd backend && npx prisma generate
cd backend && npm run test
cd frontend && npm run test
```
(Usar `migrate deploy` no lugar de `migrate dev` caso o banco já contenha dados.)

### Definition of Done
- [ ] Schema atualizado; relações em User/Product adicionadas.
- [ ] Migration aplicada; `prisma generate` rodado.
- [ ] Suíte existente verde.
- [ ] Bloco "Fase 1" preenchido no Log de Progresso.

---

## 7. Fase 2 — Backend (Node/Express/Prisma) + Testes

### Objetivo
Criar a área `/api/stock` com `listInventory`, `getProductHistory` e
`registerMovement`, usando transação Prisma e validação Zod, escopado por
`req.user.userId`. Sem alterar controllers/routes de Orders, Payments ou
Products.

### Escopo
- `backend/src/controllers/StockController.js` (novo)
- `backend/src/routes/stockRoutes.js` (novo)
- `backend/src/app.js` (apenas montar a rota)
- `backend/tests/stock.test.js` (novo)

### Tarefas (TDD — testes primeiro)

#### 7.1 Testes — `backend/tests/stock.test.js`
Seguir o padrão de `backend/tests/products.test.js` (`beforeAll` registra/loga um
usuário de teste; `afterAll`/`afterEach` limpam). Cenários obrigatórios:

- Autenticação: `GET /api/stock`, `GET /api/stock/:productId/history`,
  `POST /api/stock/movements` sem token → 401/403.
- `registerMovement` ENTRADA: cria `StockMovement` (quantity positiva) e faz
  upsert em `Inventory` incrementando; retorna 201 com o movimento e o saldo.
- `registerMovement` SAIDA: cria movimento com quantity **negativa** e decrementa
  o saldo.
- SAIDA que levaria o estoque a negativo → 400 (proibido estoque negativo).
- `registerMovement` AJUSTE: define saldo absoluto; registra movimento com o
  delta (positivo/negativo/zero conforme o caso).
- Validação: `quantity` inválida (0 para ENTRADA/SAIDA, não inteiro, ausente) →
  400; `type` inválido → 400; `productId` inexistente → 404; `reason` muito
  longo → 400.
- `listInventory`: retorna apenas registros do usuário logado, com join em
  `Product` (traz `code`, `name`, `size`).
- `getProductHistory`: retorna apenas `StockMovement` do produto+usuário;
  produto de outro usuário não é acessível (404 ou lista vazia).
- Isolamento entre usuários: usuário B não vê nem movimenta o estoque do
  usuário A.
- Consistência transacional: se a operação falhar, nada é gravado (mockar falha
  e afirmar ausência de gravação parcial).

#### 7.2 Validação (Zod) — no `StockController.js`
```js
const movementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
  quantity: z.number().int(), // magnitude (ENTRADA/SAIDA) ou saldo-alvo (AJUSTE)
  reason: z.string().max(255).optional(),
});
```
Regras de sinal aplicadas no controller (não no schema, pois dependem do `type`):
- ENTRADA: `quantity` deve ser `> 0`; movimento grava `+quantity`.
- SAIDA: `quantity` deve ser `> 0`; movimento grava `-quantity`; estoque não
  pode ficar negativo.
- AJUSTE: `quantity` deve ser `>= 0` (saldo-alvo); `delta = alvo - atual`;
  movimento grava `delta` (sinalizado); `inventory.quantity = alvo`.

#### 7.3 Controller — `StockController.js`
Padrão: instanciar `PrismaClient` (ou reaproveitar `../config/database`), usar
`prisma.$transaction` em `registerMovement`. Tratamento de erro igual ao
`paymentsController`/`productController` (ZodError → 400; outros erros com
`error.message`; 404 quando produto não encontrado).

- `listInventory`: `prisma.inventory.findMany({ where: { userId }, include: { product: true } })`
  → mapear para `{ productId, code, name, size, quantity }`.
- `getProductHistory`: `prisma.stockMovement.findMany({ where: { userId, productId }, orderBy: { createdAt: 'desc' } })`.
  Validar que o produto existe; se não pertencer ao escopo, retornar 404.
- `registerMovement`: em `prisma.$transaction`:
  1. Buscar o `Product` por `id` (catálogo global); se não existir, `throw` 404.
  2. Buscar/criar o `Inventory` (`upsert` usando `where: { userId_productId: { userId, productId } }`).
  3. Para ENTRADA/SAIDA: computar novo saldo; se SAIDA e `novo < 0`, `throw` 400.
  4. Para AJUSTE: `delta = quantity - inventory.quantity`; `novo = quantity`.
  5. `tx.stockMovement.create({ data: { userId, productId, quantity: <signed>, type, reason } })`.
  6. `tx.inventory.upsert({ where: { userId_productId }, create: {...}, update: { quantity: novo } })`.
  7. Retornar 201 com `{ movement, inventory: { productId, quantity: novo } }`.

  > Atenção (pitfall do `AGENTS.md`): em transação Prisma, leituras ficam _stale_
  > após um create; ao recomputar saldo, incluir explicitamente o novo registro.

#### 7.4 Rotas — `stockRoutes.js`
```js
const express = require('express');
const router = express.Router();
const stockController = require('../controllers/StockController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', stockController.listInventory);
router.get('/:productId/history', stockController.getProductHistory);
router.post('/movements', stockController.registerMovement);

module.exports = router;
```

#### 7.5 Montar em `app.js`
Adicionar (seguindo o padrão dos outros mounts):
```js
const stockRoutes = require('./routes/stockRoutes');
app.use('/api/stock', stockRoutes);
```

### Critérios de aceitação (PT-BR)
- `GET /api/stock` retorna o saldo por produto do usuário logado (com dados do produto).
- `GET /api/stock/:productId/history` retorna o histórico do produto.
- `POST /api/stock/movements` registra ENTRADA/SAIDA/AJUSTE com consistência
  transacional e proíbe estoque negativo.
- Tudo escopado por `req.user.userId`; usuário não acessa dados de outro.
- `Orders`/`Payments`/`Products` permanecem inalterados.
- Novos testos passam e a suíte existente continua verde.

### Verificação
```bash
cd backend && npm run test
cd backend && npm run test:watch   # opcional, durante o desenvolvimento
# Smoke manual (após subir o backend):
curl -s http://localhost:4000/health
# (usar token válido obtido via /api/auth/login)
curl -X GET http://localhost:4000/api/stock -H "Authorization: Bearer <TOKEN>"
```

### Definition of Done
- [ ] `StockController.js`, `stockRoutes.js`, `stock.test.js` criados.
- [ ] Rota montada em `app.js`.
- [ ] Testes (TDD) escritos antes/along da lógica e passando.
- [ ] Suíte completa verde.
- [ ] Bloco "Fase 2" preenchido no Log de Progresso.

---

## 8. Fase 3 — Frontend (React/Tailwind/Flowbite) + Testes

### Objetivo
Criar a página `Stock` (orquestrador + hook + componentes + helpers), o shim, a
rota e o item de navegação, consumindo `/api/stock`. Sem alterar páginas
existentes além de `App.jsx`, `Header.jsx` e `MobileDrawer.jsx` (apenas para
adicionar rota/link).

### Escopo
- `frontend/src/pages/Stock/index.jsx` (orquestrador, novo)
- `frontend/src/pages/Stock/useStock.js` (hook, novo)
- `frontend/src/pages/Stock/utils/stockHelpers.js` (funções puras, novo)
- `frontend/src/pages/Stock/components/StockTable.jsx` (novo)
- `frontend/src/pages/Stock/components/MovementDialog.jsx` (novo)
- `frontend/src/pages/Stock/components/HistoryDialog.jsx` (novo)
- `frontend/src/pages/StockPage.jsx` (shim, novo)
- `frontend/src/App.jsx` (rota), `Header.jsx` e `MobileDrawer.jsx` (nav)
- `frontend/tests/StockPage.test.jsx` (novo)

### Tarefas (TDD — testes primeiro)

#### 8.1 Testes — `frontend/tests/StockPage.test.jsx`
Seguir o padrão de `frontend/tests/ProductsPage.test.jsx` (RTL + `vi.mock`).
Cenários obrigatórios:

- Renderiza a tabela com `code`, `name`, `quantity` vindos da API.
- Estado de _loading_ e de erro.
- `ActionMenu` (kebab) por linha expõe "Nova Entrada", "Nova Saída", "Ver Histórico".
- `MovementDialog`: submeter chama `POST /api/stock/movements` e fecha; labels em
  PT-BR; validação de quantidade obrigatória (`fireEvent.submit` para campos
  obrigatórios em jsdom).
- `HistoryDialog`: exibe a lista de movimentações (data, tipo, quantidade, motivo).
- _Toast_ de sucesso ao registrar movimento e recarrega a lista.
- Isolamento de mocks: factories com arrow wrappers lazy / `vi.hoisted()`.

#### 8.2 Helpers — `utils/stockHelpers.js`
Funções puras, por exemplo: mapear `StockMovementType` para rótulos PT-BR
(`ENTRADA → "Entrada"` etc.), classe de cor para estoque baixo, formatação de
quantidade, e o objeto `MOVEMENT_TYPES` similar a `PRODUCT_STATUS` em
`productHelpers.js`.

#### 8.3 Hook — `useStock.js`
Padrão do `useProducts.js`: estados `inventory`, `loading`, `error`; `useEffect`
que chama `api.get('/stock')`; `handleRegisterMovement(payload)` que chama
`api.post('/stock/movements', payload)`, exibe _toast_ e recarrega; função para
abrir o histórico (`getStockHistory(productId)`). Expor setters para os modais.

> Convenção: as páginas atuais chamam `api` diretamente no hook (não há
> _wrappers_ em `services/api.js`). Manter esse padrão. Se preferir adicionar
> _wrappers_ `getStock/getStockHistory/postStockMovement` em `services/api.js`,
> documentar a decisão no handoff — mas o recomendado é seguir o padrão existente
> (chamadas diretas no hook).

#### 8.4 Componentes — `components/`
- `StockTable.jsx`: tabela responsiva com `data-label` (padrão Flowbite). Colunas:
  **Código**, **Nome do Produto**, **Estoque Atual**, **Ações**. O `ActionMenu`
  (kebab, `z-[80]`) por linha com "Nova Entrada", "Nova Saída", "Ver Histórico".
- `MovementDialog.jsx`: modal com formulário. Campos: **Tipo** (`Select`:
  Entrada/Saída/Ajuste), **Quantidade** (`input number`), **Motivo** (`textarea`).
  Ao submeter, chama `handleRegisterMovement`. z-index `z-[60]`.
- `HistoryDialog.jsx`: modal/drawer que lista `StockMovement` do produto (Data,
  Tipo, Quantidade, Motivo).

#### 8.5 Shim, rota e navegação
- `frontend/src/pages/StockPage.jsx` (uma linha):
  ```jsx
  export { default } from './Stock/index.jsx';
  ```
- Em `App.jsx`: `import StockPage from './pages/StockPage';` e
  `<Route path="/stock" element={<StockPage />} />` dentro do `ProtectedRoute`.
- Em `Header.jsx` (`navLinks`) e `MobileDrawer.jsx` (`navItems`): adicionar
  ```js
  { to: '/stock', icon: Boxes, label: 'Estoque' }
  ```
  usando `Boxes` do `lucide-react` (evitar reutilizar `Package`, já usado em
  "Produtos"). Importar `Boxes` nos dois arquivos.

### Critérios de aceitação (PT-BR)
- Página `/stock` acessível após login, listando o saldo por produto.
- Menu de ação por linha com Entrada/Saída/Histórico.
- `MovementDialog` registra movimentação (ENTRADA/SAIDA/AJUSTE) e atualiza a lista.
- `HistoryDialog` mostra o histórico do produto.
- _Toasts_ de feedback; estado de loading/erro tratados; labels PT-BR.
- Item "Estoque" no menu (desktop e mobile).
- `npm run build` e `npm run format:check` limpos; suítes verde.

### Verificação
```bash
cd frontend && npm run test
cd frontend && npm run build
npm run format:check
```

### Definition of Done
- [ ] Página `Stock` (orquestrador, hook, helpers, componentes) criada.
- [ ] Shim, rota em `App.jsx` e link de navegação adicionados.
- [ ] Testes (TDD) escritos e passando.
- [ ] `npm run build` e `format:check` limpos; suíte existente verde.
- [ ] Bloco "Fase 3" preenchido no Log de Progresso.

---

## 9. Preparação para o Futuro (não implementar agora)

Este design deixa o terreno preparado para, futuramente, movimentar o estoque
automaticamente a partir de pedidos. Quando houver "tipos de pedidos
específicos" (ex.: _Pedido de Compra_):

1. O usuário cria o _Pedido de Compra_ em um novo módulo.
2. O backend marca o pedido como _Recebido_.
3. Nesse momento, o backend **reaproveita a mesma transação de
   `StockController`** (refatorar para um serviço `StockService` reutilizável)
   para inserir uma `StockMovement` de `ENTRADA` e atualizar o `Inventory`.
4. O mesmo valerá para saídas futuras.

> Não implementar nada disso nas Fases 1–3. Apenas garantir que a transação de
> `registerMovement` fique isolada o suficiente para ser extraída depois em um
> `StockService` (decisão de design a registrar no handoff da Fase 2).

---

## 10. Protocolo de Finalização (após TODAS as fases)

Seguir o **New Feature Workflow** do `AGENTS.md`:

1. Ao concluir a Fase 3, perguntar ao usuário:
   > Você tem mais algum ajuste a adicionar nesta versão?
2. Se **sim**: anexar bloco em `NOTES.md` (seguir o template no topo desse
   arquivo) e encerrar. Não editar `CHANGELOG.md`.
3. Se **não**: consolidar tudo (incluindo blocos do `NOTES.md`) em uma nova
   seção `## Phase N` no topo de `CHANGELOG.md` (agrupar em `Added`, `Changed`,
   `Fixed`, `Tests`) e remover os blocos consolidados de `NOTES.md`.
4. Atualizar `ARCHITECTURE.md` (nova área `/api/stock`, pasta `Stock`, modelos
   `Inventory`/`StockMovement` no domínio), `docs/data-model.md` (diagrama ER +
   enum `StockMovementType`) e `AGENTS.md` (apenas se houver regras técnicas novas).

---

## 11. Log de Progresso (preenchido pelos agentes)

> Cada agente preenche o bloco da fase que concluiu. Não apagar blocos anteriores.

### Modelo de bloco (copiar e preencher)

```text
### Fase <N> — <Status: ✅ Concluída | ⚠️ Parcial | ❌ Bloqueada>

- O que foi implementado:
- Arquivos criados:
- Arquivos alterados:
- Testes adicionados/atualizados (e resultado da verificação):
- Decisões tomadas / desvios do plano:
- Migration gerada (Fase 1): <nome>
- Bloqueios / pendências para a próxima fase:
- Ponto de partida do próximo agente (o que ler e qual comando rodar primeiro):
- Hash do commit (se aplicável):
```

### Fase 1

_(a preencher ao concluir a Fase 1)_

### Fase 2

_(a preencher ao concluir a Fase 2)_

### Fase 3

_(a preencher ao concluir a Fase 3)_

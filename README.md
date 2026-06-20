# Receivables Control System

Sistema de controle de recebíveis desenvolvido com **Node.js**, **Express**, **React** e **PostgreSQL**. Permite gerenciar pessoas, pedidos, itens e pagamentos com atualização automática de status e dashboard de analytics.

> 🤖 **Desenvolvido com auxílio de IA**: Este projeto foi construído com assistência de inteligência artificial (opencode), seguindo metodologia TDD e boas práticas de desenvolvimento.

> ⚠️ **Projeto local**: Este sistema foi desenvolvido exclusivamente para execução em ambiente de desenvolvimento local. Não inclui configurações de produção como HTTPS, load balancing ou orquestração em nuvem.

---

## Funcionalidades

- **Autenticação JWT** — Login seguro com token stateless e hash bcrypt
- **Gestão de Pessoas** — CRUD completo (nome, contato)
- **Gestão de Pedidos** — CRUD com itens dinâmicos (descrição, valor, pessoa associada)
- **Processamento de Pagamentos** — Registro com validação de saldo e rejeição de overpayment
- **Status Automático** — Pedidos transitam entre *Pendente*, *Parcial* e *Quitado*
- **Dashboard Analytics** — KPIs (total pendente, quitado, recebimentos do mês) + gráfico por pessoa
- **Exportação Excel** — Relatório de 4 planilhas com formatação BRL
- **Modo escuro/claro** — Alternância com persistência em `localStorage`
- **Design responsivo** — Navegação desktop e mobile com menu inferior
- **Aritmética de centavos** — Cálculos financeiros com inteiros, sem erros de ponto flutuante

---

## Pré-requisitos

### Com Docker
- [Docker](https://docs.docker.com/get-docker/) (versão 24+)
- [Docker Compose](https://docs.docker.com/compose/install/) (plugin `docker compose` ou comando `docker-compose`)

### Sem Docker
- **Node.js** 18.x
- **npm** 9.x
- **PostgreSQL** 15.x rodando localmente

---

## Como Rodar — Com Docker

### Linux

```bash
# Clone o repositório
git clone <url-do-repositorio> receivables-control
cd receivables-control

# Inicie todos os serviços
docker compose up --build
```

### Windows (PowerShell)

```powershell
# Clone o repositório
git clone <url-do-repositorio> receivables-control
cd receivables-control

# Inicie todos os serviços
docker compose up --build
```

> O Docker Compose inicia 4 serviços: **db** (PostgreSQL 15), **backend** (Express na porta 4000), **frontend** (Vite na porta 3000) e **adminer** (interface de banco na porta 8080).

Acesse o sistema em: **http://localhost:3000**

### Parar os serviços

```bash
docker compose down
```

Para remover também os volumes (dados do banco):

```bash
docker compose down -v
```

---

## Como Rodar — Sem Docker

### 1. Configure o banco PostgreSQL

Crie um banco de dados PostgreSQL com as credenciais de sua preferência. Exemplo:

```sql
CREATE USER admin WITH PASSWORD 'admin';
CREATE DATABASE receivables OWNER admin;
```

### 2. Configure as variáveis de ambiente

Edite o arquivo `backend/.env` alterando a `DATABASE_URL` para apontar para seu PostgreSQL local:

```env
# Linux (conexão via socket ou localhost)
DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables?schema=public"

# Windows (conexão via localhost)
DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables?schema=public"
```

> **Importante**: Em ambiente sem Docker, substitua `db` por `localhost` na string de conexão.

### 3. Backend

```bash
cd backend

# Instale as dependências
npm install

# Execute as migrations para criar as tabelas
npx prisma migrate dev --name init

# (Opcional) Execute o seed para criar o usuário admin
npx prisma db seed

# Inicie o servidor de desenvolvimento
npm run dev
```

O backend estará disponível em **http://localhost:4000**.

### 4. Frontend

Em um segundo terminal:

```bash
cd frontend

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

O frontend estará disponível em **http://localhost:3000**.

> O Vite faz proxy das requisições `/api` para o backend em `http://localhost:4000` (configurado em `frontend/vite.config.js`).

---

## Credenciais Padrão

| Campo   | Valor      |
|---------|------------|
| Usuário | `admin`    |
| Senha   | `admin123` |

---

## Acessos

| Serviço  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:3000     |
| Backend  | http://localhost:4000     |
| Adminer  | http://localhost:8080     |

---

## Executar Testes

### Backend (82 testes)

```bash
cd backend
npm run test
```

### Frontend (183 testes)

```bash
cd frontend
npm run test
```

### Modo watch

```bash
cd backend && npm run test:watch
cd frontend && npm run test:watch
```

---

## Tech Stack

| Camada       | Tecnologia                             |
|-------------|----------------------------------------|
| Backend     | Node.js, Express, Prisma, Zod          |
| Frontend    | React, Vite, Tailwind CSS, Recharts    |
| Banco       | PostgreSQL 15                          |
| Testes      | Vitest, React Testing Library, Supertest |
| Autenticação| JWT, bcryptjs                          |
| Containers  | Docker, Docker Compose                 |

---

## Estrutura do Projeto

```
receivables-control/
├── backend/
│   ├── prisma/          # Schema + migrations + seed
│   ├── src/
│   │   ├── controllers/ # Lógica das rotas
│   │   ├── middlewares/  # Autenticação JWT
│   │   ├── routes/       # Definição de rotas
│   │   └── utils/        # Utilitários financeiros
│   └── tests/           # Testes automatizados
├── frontend/
│   ├── src/
│   │   ├── components/  # Header, Nav, Toast, etc.
│   │   ├── pages/       # Dashboard, Pessoas, Pedidos, etc.
│   │   ├── services/    # Axios client
│   │   ├── context/     # AuthContext, ThemeContext
│   │   └── utils/       # formatBRL, exportExcel
│   └── tests/           # Testes automatizados
├── docs/                # ROADMAP.md
└── docker-compose.yml   # Orquestração dos serviços
```

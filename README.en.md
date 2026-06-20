# Receivables Control System

A receivables management system built with **Node.js**, **Express**, **React**, and **PostgreSQL**. Manage people, orders, items, and payments with automatic status transitions and an analytics dashboard.

> ⚠️ **Local-only project**: This system is designed exclusively for local development. It does not include production configurations such as HTTPS, load balancing, or cloud orchestration.

---

## Features

- **JWT Authentication** — Secure stateless login with bcrypt password hashing
- **People Management** — Full CRUD (name, contact)
- **Order Management** — CRUD with dynamic items (description, value, associated person)
- **Payment Processing** — Register payments with balance validation and overpayment rejection
- **Automatic Status** — Orders transition between *Pending*, *Partial*, and *Paid*
- **Analytics Dashboard** — KPIs (total pending, total paid, current month revenue) + per-person chart
- **Excel Export** — 4-sheet workbook with BRL currency formatting
- **Dark/Light Mode** — Toggle with `localStorage` persistence
- **Responsive Design** — Desktop navigation and mobile bottom nav bar
- **Integer Cents Arithmetic** — Financial calculations using integers, no floating-point errors

---

## Prerequisites

### With Docker
- [Docker](https://docs.docker.com/get-docker/) (version 24+)
- [Docker Compose](https://docs.docker.com/compose/install/) (`docker compose` plugin or `docker-compose` command)

### Without Docker
- **Node.js** 18.x
- **npm** 9.x
- **PostgreSQL** 15.x running locally

---

## How to Run — With Docker

### Linux

```bash
# Clone the repository
git clone <repo-url> receivables-control
cd receivables-control

# Start all services
docker compose up --build
```

### Windows (PowerShell)

```powershell
# Clone the repository
git clone <repo-url> receivables-control
cd receivables-control

# Start all services
docker compose up --build
```

> Docker Compose starts 4 services: **db** (PostgreSQL 15), **backend** (Express on port 4000), **frontend** (Vite on port 3000), and **adminer** (database UI on port 8080).

Access the system at: **http://localhost:3000**

### Stop services

```bash
docker compose down
```

To also remove volumes (database data):

```bash
docker compose down -v
```

---

## How to Run — Without Docker

### 1. Set up PostgreSQL

Create a PostgreSQL database with your preferred credentials. Example:

```sql
CREATE USER admin WITH PASSWORD 'admin';
CREATE DATABASE receivables OWNER admin;
```

### 2. Configure environment variables

Edit `backend/.env` and update `DATABASE_URL` to point to your local PostgreSQL:

```env
DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables?schema=public"
```

> **Important**: When running without Docker, replace `db` with `localhost` in the connection string.

### 3. Backend

```bash
cd backend

# Install dependencies
npm install

# Run migrations to create tables
npx prisma migrate dev --name init

# (Optional) Seed the admin user
npx prisma db seed

# Start development server
npm run dev
```

The backend will be available at **http://localhost:4000**.

### 4. Frontend

In a second terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at **http://localhost:3000**.

> Vite proxies `/api` requests to the backend at `http://localhost:4000` (configured in `frontend/vite.config.js`).

---

## Default Credentials

| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

---

## Endpoints

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:3000     |
| Backend  | http://localhost:4000     |
| Adminer  | http://localhost:8080     |

---

## Running Tests

### Backend (82 tests)

```bash
cd backend
npm run test
```

### Frontend (183 tests)

```bash
cd frontend
npm run test
```

### Watch mode

```bash
cd backend && npm run test:watch
cd frontend && npm run test:watch
```

---

## Tech Stack

| Layer        | Technology                            |
|-------------|---------------------------------------|
| Backend     | Node.js, Express, Prisma, Zod         |
| Frontend    | React, Vite, Tailwind CSS, Recharts   |
| Database    | PostgreSQL 15                          |
| Testing     | Vitest, React Testing Library, Supertest |
| Auth        | JWT, bcryptjs                         |
| Containers  | Docker, Docker Compose                |

---

## Project Structure

```
receivables-control/
├── backend/
│   ├── prisma/          # Schema + migrations + seed
│   ├── src/
│   │   ├── controllers/ # Route logic
│   │   ├── middlewares/  # JWT authentication
│   │   ├── routes/       # Route definitions
│   │   └── utils/        # Financial utilities
│   └── tests/           # Automated tests
├── frontend/
│   ├── src/
│   │   ├── components/  # Header, Nav, Toast, etc.
│   │   ├── pages/       # Dashboard, People, Orders, etc.
│   │   ├── services/    # Axios client
│   │   ├── context/     # AuthContext, ThemeContext
│   │   └── utils/       # formatBRL, exportExcel
│   └── tests/           # Automated tests
├── docs/                # ROADMAP.md
└── docker-compose.yml   # Service orchestration
```

# Receivables Control System - Architecture Documentation

## Overview
This document describes the current state of the project architecture, file organization, and how to run the system. The project is currently in **Phase 3: Express Core Server & Auth Layer** completed.

## Technology Stack
- **Backend**: Node.js (Express) with Prisma ORM
- **Frontend**: React with Vite and Tailwind CSS
- **Database**: PostgreSQL 15
- **Infrastructure**: Docker and Docker Compose

## Ports Configuration
- **Backend API**: http://localhost:4000
- **Frontend Application**: http://localhost:3000
- **PostgreSQL Database**: localhost:5432 (internal to Docker network)
- **Adminer Database UI**: http://localhost:8080

## Folder Structure
```
oc-receivables-control/
├── docker-compose.yml          # Root Docker Compose orchestration
├── ARCHITECTURE.md             # This file
├── AGENTS.md                   # Original project specs
├── docs/
│   └── ROADMAP.md              # Detailed implementation roadmap
├── backend/
│   ├── Dockerfile              # Backend container definition
│   ├── entrypoint.sh           # Entrypoint script (DB wait & migrations)
│   ├── package.json            # Backend dependencies & scripts
│   ├── .env                    # Environment variables (DB, JWT, etc.)
│   ├── prisma/
│   │   └── schema.prisma       # Prisma database schema
│   └── src/
│       ├── server.js           # Entry point (starts Express server)
│       ├── app.js              # Express app setup (CORS, middleware, routes)
│       ├── config.js           # Environment configuration loader
│       │   └── database.js     # Prisma client singleton
│       ├── middlewares/
│       │   └── auth.js         # JWT authentication middleware (placeholder)
│       ├── controllers/
│       │   └── authController.js # Auth login controller (placeholder)
│       └── routes/
│           └── authRoutes.js   # Auth route definitions (/api/auth/login)
├── frontend/
│   ├── Dockerfile              # Frontend container definition
│   ├── package.json            # Frontend dependencies & scripts
│   ├── index.html              # HTML template
│   └── src/
│       ├── main.jsx            # React entry point
│       └── App.jsx             # Root React component (placeholder)
```

## Docker Services
Defined in `docker-compose.yml` with network `receivables-network`:
- **db**: PostgreSQL 15-alpine
  - Ports: 5432:5432
  - Environment: POSTGRES_USER=admin, POSTGRES_PASSWORD=admin, POSTGRES_DB=receivables
  - Volume: postgres_data (persistent storage)
  - Healthcheck: pg_isready for service readiness
- **backend**: Node.js service
  - Builds from ./backend/Dockerfile
  - Ports: 4000:4000
  - Env file: ./backend/.env
  - Depends on: db (with healthcheck)
  - Volumes: ./backend:/app (live code reload), /app/node_modules (container node_modules)
  - Entrypoint: /app/entrypoint.sh (handles DB wait and migrations)
- **frontend**: Vite React service
  - Builds from ./frontend/Dockerfile
  - Ports: 3000:3000
  - Volumes: ./frontend:/app (live code reload), /app/node_modules
- **adminer**: Database administration UI
  - Image: adminer
  - Ports: 8080:8080
  - Depends on: db

## Backend Configuration (.env)
```dotenv
# Database Configuration
DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables?schema=public"

# JWT Configuration
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="24h"

# Server Configuration
PORT=4000
NODE_ENV=development
```

## Available npm Scripts
### Backend (`backend/package.json`)
- `npm run dev` - Start backend with nodemon (development)
- `npm start` - Start backend with node (production)

### Frontend (`frontend/package.json`)
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## How to Run the System
1. Ensure Docker and Docker Compose are installed
2. From the project root:
   ```bash
   docker compose up --build
   ```
3. Services will be available:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000 (health check at /health)
   - Adminer: http://localhost:8080 (use PostgreSQL credentials from .env)
4. To stop: `docker compose down`
5. To rebuild after code changes: `docker compose up --build` or `docker compose up -d --build`

## Current Implementation Status (Phase 3 Complete)
✅ Docker Compose orchestration with all required services
✅ Backend Express server with CORS and JSON middleware
✅ Basic health check endpoint (`GET /health`)
✅ Authentication route structure configured (`/api/auth/login`)
✅ Authentication middleware implemented (`src/middlewares/auth.js`)
✅ Authentication controller implemented with JWT and bcrypt (`src/controllers/authController.js`)
✅ Auth routes implemented (`src/routes/authRoutes.js`)
✅ Frontend React entry point with basic container component
✅ Environment configuration files
✅ Dockerfiles for both backend and frontend
✅ Volume mounting for live development
✅ Prisma schema with User, Person, Order, Item, Payment entities
✅ Database migration completed and tables created
✅ Proper relationships and cascade rules established
✅ Working JWT authentication system with bcrypt password hashing
✅ Admin user seeded in database
✅ Centralized error handling middleware for Zod validation errors

## Next Steps (Phase 3)
When ready to proceed, Phase 3 will involve:
- Implementing core Express server architecture with `src/server.js` & `src/app.js`
- Creating authentication middleware in `src/middlewares/auth.js`
- Building authentication controller and routes in `src/controllers/authController.js` and `src/routes/authRoutes.js`
- Adding JWT validation and bcrypt password hashing for secure authentication

## Notes for Developers/Agents
- Backend source is mounted at `/app` inside container for live editing
- Frontend source similarly mounted for hot module replacement
- Node modules are installed within containers (separate from host)
- Environment variables are loaded via `.env` file for backend
- Frontend assumes backend API at `http://localhost:4000` (adjust in future API service)
- All financial calculations should use Decimal(10,2) as per financial rules in AGENTS.md
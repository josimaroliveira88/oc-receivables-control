# Receivables Control System

## Technology Stack

Backend:
- Node.js
- Express
- Prisma ORM

Frontend:
- React
- Vite
- Tailwind CSS

Database:
- PostgreSQL 15

Infrastructure:
- Docker

## Ports

Backend: 4000
Frontend: 3000
Database: 5432

Backend API Prefix:
- /api

## Authentication

- Stateless JWT
- Seeded admin user

## Localization

Internal artifacts:
- English

User-facing content:
- Portuguese (Brazil)

## Financial Rules

- Monetary fields must use Decimal(10,2)
- Avoid floating point arithmetic
- Preserve financial consistency

## TDD Methodology (Required from Phase 5 onward)

All phases starting from Phase 5 must follow Test-Driven Development:

1. **Write tests before implementation**: Before writing any business logic, identify and write test cases that define the expected behavior.
2. **Backend tests** (Vitest or Jest):
   - Services, financial calculations, validation rules
   - Priority: partial payment, full payment, overpayment rejection, status transitions, transactional consistency
3. **Frontend tests** (React Testing Library):
   - Forms, authentication flow, protected routes, financial validations
4. **Run tests as verification**: Tests must pass before marking a phase as complete.
5. **Test commands**: Must be documented in AGENTS.md under "Available Test Scripts" and added to `package.json`.

Do not create untestable business logic.

## Documentation Practices

After completing each phase of development, the implementing agent must:
1. Update the project documentation to reflect changes made
2. Ensure ARCHITECTURE.md is current with the latest file structure and setup instructions
3. Update AGENTS.md if any technical specifications or rules change
4. Document any environment variables, configuration changes, or new dependencies
5. Make sure ROADMAP.md accurately reflects completed and pending work
6. Document test files and coverage under "## Available Test Scripts"

This ensures future agents can understand the project state and continue development seamlessly.

## Phase Completion Notes

Phase 2 (Database Modeling & Migrations) has been completed:
- Prisma schema created with User, Person, Order, Item, and Payment entities
- Database migrations executed and tables created in PostgreSQL
- Proper relationships and cascade rules established:
  - Order has 1:N relationships with Item and Payment (Cascade delete)
  - Person has 1:N relationships with Item and Payment (SetNull on delete)
  - All monetary fields use Decimal(10,2) precision as required

Phase 3 (Express Core Server & Auth Layer) has been completed:
- Implemented core Express server architecture with src/server.js & src/app.js
- Created authentication middleware in src/middlewares/auth.js
- Built authentication controller and routes in src/controllers/authController.js and src/routes/authRoutes.js
- Added JWT validation and bcrypt password hashing for secure authentication
- Implemented centralized error handling middleware for Zod validation errors
- Seeded admin user in the database
- Working Express server responds to POST /api/auth/login with valid JWT payload and expiration field

Phase 4 (Frontend Authentication Flow) has been completed:
- Created Axios client (src/services/api.js) with automatic Bearer token injection from localStorage
- Implemented AuthContext (src/context/AuthContext.jsx) managing login, logout, and token validation state
- Built ProtectedRoute component (src/components/ProtectedRoute.jsx) blocking unauthenticated views
- Developed LoginPage (src/pages/LoginPage.jsx) with PT-BR labels: "Entrar no Sistema", "Usuário", "Senha", "Acessar"
- Error message: "Usuário ou senha inválidos. Tente novamente."
- Tailwind CSS configured with PostCSS and Vite integration
- React Router routing with login and protected routes configured
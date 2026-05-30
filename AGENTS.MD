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

## Documentation Practices

After completing each phase of development, the implementing agent must:
1. Update the project documentation to reflect changes made
2. Ensure ARCHITECTURE.md is current with the latest file structure and setup instructions
3. Update AGENTS.md if any technical specifications or rules change
4. Document any environment variables, configuration changes, or new dependencies
5. Make sure ROADMAP.md accurately reflects completed and pending work

This ensures future agents can understand the project state and continue development seamlessly.

## Phase Completion Notes

Phase 2 (Database Modeling & Migrations) has been completed:
- Prisma schema created with User, Person, Order, Item, and Payment entities
- Database migrations executed and tables created in PostgreSQL
- Proper relationships and cascade rules established:
  - Order has 1:N relationships with Item and Payment (Cascade delete)
  - Person has 1:N relationships with Item and Payment (SetNull on delete)
  - All monetary fields use Decimal(10,2) precision as required
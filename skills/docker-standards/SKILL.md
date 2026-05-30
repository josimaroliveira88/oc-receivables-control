---

name: docker-standards
description: Docker and containerization standards.
---------------------------------------------------

# Docker Standards

Apply these rules to all Docker assets.

## Docker Images

Prefer official images.

Examples:

* node:lts-alpine
* postgres:15-alpine
* adminer

Avoid unnecessary dependencies.

## Image Construction

Use multi-stage builds whenever possible.

Goals:

* Reduce image size
* Reduce attack surface
* Improve build speed

## Containers

Each service must have:

* explicit container name
* restart policy
* environment variables
* exposed ports only when necessary

## Networks

Use dedicated Docker networks.

Example:

* receivables-network

All services must communicate through internal container names.

Avoid localhost references between containers.

## Volumes

Persist database data using named volumes.

Example:

* postgres_data

Never store database data inside ephemeral containers.

## Environment Variables

Use .env files.

Do not hardcode:

* passwords
* database URLs
* JWT secrets

## Health Checks

Critical services should expose health checks.

Required for:

* backend
* database

Example endpoints:

* /api/health

## Backend Container

Requirements:

* npm install
* npm run dev for local development
* proper volume mapping for hot reload

## Frontend Container

Requirements:

* Vite dev server
* hot reload support
* mapped source directory

## Database Container

Requirements:

* PostgreSQL 15
* persistent volume
* startup credentials from environment variables

## Compose Standards

Use:

* docker-compose.yml

Requirements:

* named services
* named volumes
* named networks

Keep service definitions modular and readable.

## Port Conventions

Backend:

* 4000

Frontend:

* 3000

Database:

* 5432

Adminer:

* 8080

## Production Readiness

Development convenience must not compromise future production deployment.

Avoid:

* privileged containers
* root users when unnecessary
* unrestricted network exposure

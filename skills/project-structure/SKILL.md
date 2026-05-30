---

name: project-structure
description: Project organization and folder conventions.
---------------------------------------------------------

# Project Structure

Maintain a clear separation of concerns.

## Backend Structure

backend/

src/
├── controllers/
├── services/
├── routes/
├── middlewares/
├── validations/
├── utils/
├── config/
├── prisma/
└── server.js

## Frontend Structure

frontend/

src/
├── components/
├── pages/
├── context/
├── services/
├── hooks/
├── layouts/
├── utils/
└── App.jsx

## Responsibilities

Controllers:

* HTTP handling only

Services:

* Business rules

Routes:

* Endpoint mapping

Middlewares:

* Cross-cutting concerns

Utils:

* Generic helpers

Context:

* Global React state

Components:

* Reusable UI

Pages:

* Route-level screens

## File Naming

Use descriptive names.

Examples:

* authController.js
* paymentService.js
* ordersRoutes.js
* LoginPage.jsx

Avoid generic names.

Examples:

* helper.js
* misc.js
* util.js

## Imports

Prefer absolute imports when project configuration supports them.

Keep import ordering consistent.

## Code Organization

One responsibility per file.

Avoid large files with mixed concerns.

## Maintainability

Favor readability over clever implementations.

Business rules must remain easy to locate and test.

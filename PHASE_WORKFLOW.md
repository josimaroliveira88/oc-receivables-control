# Phase Implementation Workflow

**⚠️ NOTE**: All 16 MVP phases are **COMPLETED**. This workflow document is now used for implementing **new features requested by the client**.

When the client requests new features, create a new phase plan following the same principles below, adding it to `docs/ROADMAP.md` after Phase 16.

To implement a new client feature as a new phase:

## Standard File References (Case-Sensitive)
- Technology specs: `AGENTS.md` (root)
- Architecture docs: `ARCHITECTURE.md` (root)
- Phase roadmap: `docs/ROADMAP.md`
- Skills & patterns: `.opencode/skills/` directory

## Implementation Process for New Features
1. **Verify current state**:
   - Read `AGENTS.md` for tech stack, rules, and completed MVP phases
   - Read `ARCHITECTURE.md` to understand current implementation
   - Read `docs/ROADMAP.md` — note that all 16 MVP phases are complete
   - Review "Lessons Learned / Pitfalls to Avoid" in AGENTS.md (critical knowledge)

2. **Plan new feature phase**:
   - Gather client requirements clearly
   - Define acceptance criteria in PT-BR
   - Add new phase section to ROADMAP.md following the template
   - Plan database schema changes (if any) via Prisma migrations
   - Identify backend endpoints needed (if any)
   - Identify frontend pages/components needed (if any)
   - Plan test coverage (backend + frontend)

3. **Write tests in dedicated test phases**:
   - Implementation and test phases are separate (even for new features)
   - Backend tests: Use Vitest + supertest (existing patterns in `backend/tests/`)
   - Frontend tests: Use React Testing Library + vi.mock (existing patterns in `frontend/tests/`)
   - Follow test naming conventions and mocking patterns from existing test files
   - Priority scenarios: validation, edge cases, error handling, PT-BR labels, financial precision

4. **Implement strictly within phase scope**:
   - Follow existing code conventions (see `.opencode/skills/` directory for style guides)
   - Use only approved technologies from the tech stack (Node.js, Express, React, Prisma, etc.)
   - Do NOT implement features from subsequent phases
   - Use existing utilities when possible (money.js for BRL calculations, etc.)
   - Maintain the 164+ existing tests passing with zero regressions

5. **Run tests and verify**:
   - All 164 existing tests must still pass
   - New feature tests must pass
   - Run full test suite: `npm run test` in both `backend/` and `frontend/`
   - If existing tests fail, fix implementation (not the tests) until all pass
   - Confirm no regressions in People, Orders, Payments, Dashboard, or Export features

6. **Update documentation upon completion**:
   - In `ROADMAP.md`:
     - Change new phase status to `✅ COMPLETED`
     - Document deliverables with test count
   - In `ARCHITECTURE.md`:
     - Update folder structure if new files/folders added
     - Document new endpoints if new backend features
     - Update "Available npm Scripts" if new scripts needed
   - In `AGENTS.md`:
     - Add completion notes under "MVP Project Status" or create new section if major feature
     - Document any new technical specifications or rules
     - Document new test scripts in "Available Test Scripts"
     - Document any new "Lessons Learned" that might help future agents
   - Update `package.json` if new dependencies added
   - Update this PHASE_WORKFLOW.md if new patterns emerge

7. **Verification protocol**:
   - Test phase-specific deliverables as described in ROADMAP.md
   - Run automated test suite (`npm test` / `npm run test`) and confirm all pass
   - Confirm no degradation in previously completed phases
   - Do not deploy, start, or reference next phase work
   - Example verification for Phase 3:
   ```bash
   # Health check
   curl -s http://localhost:4000/health

   # Valid login
   curl -X POST http://localhost:4000/api/auth/login \
   -H "Content-Type: application/json" \
   -d '{"username":"admin","password":"admin123"}'

   # Invalid login
   curl -X POST http://localhost:4000/api/auth/login \
   -H "Content-Type: application/json" \
   -d '{"username":"bad","password":"creds"}' \
   -w "\nStatus: %{http_code}\n"
   ```

## Critical Constraints
- **Never** advance phase status in documentation before completing all deliverables
- **Never** implement components from future phases "just in case"
- **Always** write tests in the dedicated test phase immediately following the implementation phase
- **Always** run the automated test suite and confirm all tests pass before marking a phase complete
- **Always** verify using the exact test cases described in the phase's deliverable section
- Test phases must cover the implementation from the immediately preceding phase
- When in doubt, re-read the specific phase section in ROADMAP.md

This workflow ensures phased implementation remains isolated, verifiable, and testable.
# Phase Implementation Workflow

To implement a specific phase without advancing to the next phase:

## Standard File References (Case-Sensitive)
- Technology specs: `AGENTS.MD` (root)
- Architecture docs: `ARCHITECTURE.md` (root)
- Phase roadmap: `docs/ROADMAP.md`

## Implementation Process
1. **Verify current state**:
   - Read `AGENTS.MD` for tech stack, rules, and phase completion notes
   - Read `ARCHITECTURE.md` to see current implementation status
   - Read `docs/ROADMAP.md` for detailed phase tasks and deliverables

2. **Identify phase work**:
   - Locate the target phase section in ROADMAP.md
   - Extract exact tasks and deliverables for THAT phase only
   - Note: Do NOT interpret or infer work for future phases

3. **Write test cases FIRST (TDD - from Phase 5 onward)**:
   - Before implementing any business logic, identify all test scenarios
   - Write failing tests that define the expected behavior
   - Backend: Use Vitest or Jest for services, controllers, validation rules
   - Frontend: Use React Testing Library for forms, auth flow, protected routes, financial validations
   - Priority test scenarios: partial payment, full payment, overpayment rejection, status transitions, transactional consistency
   - Tests must be committed alongside or before the implementation code

4. **Implement strictly within phase scope**:
   - Follow existing code conventions in the repository
   - Use only the technologies specified for that phase in ROADMAP.md
   - Do not start implementation of subsequent phase components
   - Example: If phase specifies JWT auth layer, do not build payment processing

5. **Run tests and verify**:
   - All previously written tests must now pass
   - Run the full test suite to confirm no regressions
   - If tests fail, fix implementation (not the tests) until all pass

6. **Update documentation upon completion**:
   - In `ARCHITECTURE.md`:
     - Change "Current Implementation Status" to reflect completed phase
     - Update "Next Steps" to show following phase
   - In `docs/ROADMAP.md`:
     - Change phase status from blank to `✅ COMPLETED`
   - In `AGENTS.MD`:
     - Add completion notes under "## Phase Completion Notes"
     - Document test files and test commands under "## Available Test Scripts"
   - Ensure all updates are accurate and verifiable

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
- **Always** write tests BEFORE implementation code (TDD) for Phase 5 onward
- **Always** run the automated test suite and confirm all tests pass before marking a phase complete
- **Always** verify using the exact test cases described in the phase's deliverable section
- When in doubt, re-read the specific phase section in ROADMAP.md

This workflow ensures phased implementation remains isolated, verifiable, and testable.
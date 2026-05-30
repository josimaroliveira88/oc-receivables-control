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

3. **Implement strictly within phase scope**:
   - Follow existing code conventions in the repository
   - Use only the technologies specified for that phase in ROADMAP.md
   - Do not start implementation of subsequent phase components
   - Example: If phase specifies JWT auth layer, do not build payment processing

4. **Update documentation upon completion**:
   - In `ARCHITECTURE.md`:
     - Change "Current Implementation Status" to reflect completed phase
     - Update "Next Steps" to show following phase
   - In `docs/ROADMAP.md`:
     - Change phase status from blank to `✅ COMPLETED`
   - In `AGENTS.MD`:
     - Add completion notes under "## Phase Completion Notes"
   - Ensure all updates are accurate and verifiable

5. **Verification protocol**:
   - Test phase-specific deliverables as described in ROADMAP.md
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
- **Always** verify using the exact test cases described in the phase's deliverable section
- When in doubt, re-read the specific phase section in ROADMAP.md

This workflow ensures phased implementation remains isolated and verifiable.
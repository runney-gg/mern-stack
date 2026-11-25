# SpendWise: Future Improvement Prompts

Use these prompts one at a time with a coding assistant. They are written for the existing `frontend/` and `backend/` project. Keep the application small and easy to explain in a university viva.

## 1. Preserve and verify the features already implemented

```text
Inspect my existing SpendWise project before making changes. Preserve the current React/Vite dashboard, transaction list, income/expense form, CRUD behavior, filters, summaries, charts, responsive styling, API health check, and MongoDB/Mongoose setup. Do not replace working components or rewrite the project from scratch.

Check that the frontend API helpers call the existing Express routes correctly, and that successful create, list, update, and delete operations refresh the dashboard and transaction list. Fix only concrete defects you find in these existing flows. Keep the current folder structure and avoid adding dependencies unless a specific fix requires one.

Before editing, briefly report the exact files and defects that need changes. Then make the smallest safe fixes, run the existing checks, and report what changed and how it was verified. Do not delete or alter existing MongoDB records while checking CRUD.
```

## 2. Add the missing essential project coverage

```text
Review the existing SpendWise Express/Mongoose backend and add focused automated tests for its HTTP API routes and controllers. Cover transaction create, list, update, and delete, plus invalid input, invalid IDs, missing records, filters, and the database-unavailable response. The existing tests for input parsing and filters should remain intact.

Use an isolated test database or another safe approach that cannot modify my normal local SpendWise database or its records. Reuse the current Node test setup where practical. Do not add authentication, payments, bank integrations, AI, or a large testing framework. If a test would require an unavailable service, explain that clearly instead of silently skipping it.

Also add a short README section describing the data flow: React form/API helper → Express route/controller → Mongoose model → MongoDB, and explain how to run the backend tests. Inspect first, preserve existing working files, then run the tests and report the results.
```

## 3. Fix backend and data-handling weaknesses

```text
Inspect my SpendWise backend and frontend data-fetching flow for concrete reliability or scaling problems. Pay particular attention to backend startup when MongoDB is unavailable, API error handling, stale transaction results after a failed request, and the current unpaginated GET /api/transactions response.

Implement only small, useful fixes suitable for a few-day university project. Keep the current API shape working where possible. If you add pagination, use simple page/limit query parameters with safe defaults and maximums, update the frontend helper and transaction list to use it, and preserve existing filters. Do not add a state-management library, caching layer, or other infrastructure.

Before editing, report the issues you confirmed and the minimal plan. Preserve CRUD behavior and all existing database records. Add or update focused tests for changed behavior, run the test suite and frontend build, and report any remaining limitations.
```

## 4. Improve UI readability and keyboard accessibility

```text
Review the existing SpendWise interface and make modest UI/UX and accessibility improvements without redesigning the app. Focus on readable text sizes and contrast, visible keyboard focus styles for interactive controls, and complete keyboard behavior for the transaction dialog: move focus into it when opened, close it with Escape, keep keyboard focus inside while open, and return focus to the opener when closed.

Keep the current visual style, responsive layout, React components, and transaction behavior. Do not add a UI framework or modal library. Check that loading, API-error, and empty-list states remain understandable and that the changes work at mobile widths.

Inspect first and identify concrete issues before editing. Then implement the smallest changes and verify with a production frontend build plus a brief manual or automated accessibility check. Do not modify backend data or behavior for this task.
```

## 5. Tighten validation and local-demo security

```text
Review validation and security in my existing single-user SpendWise college project. Keep the project intentionally simple: do not add authentication, authorization, payments, bank integrations, AI, or a hosted security stack.

Check server-side validation for transaction amount limits and decimal precision, category/description lengths, and search/filter input lengths. Add reasonable documented limits if they are currently missing, with clear 400 responses and focused tests. Review JSON body size handling, CORS configuration, and the backend bind address. Since this is a local demo with no authentication, make the local-only exposure boundary clear and bind to localhost where appropriate without breaking the Vite proxy.

Inspect before editing, preserve existing behavior and database records, avoid exposing `.env` values, and do not add dependencies unless essential. Run backend tests and the frontend build after changes, and summarize what is protected and what remains intentionally out of scope.
```

## 6. Complete a prioritized, end-to-end project check

```text
Perform a final readiness review of my SpendWise MERN college project using the existing codebase and the improvement areas in future.md prompts 1–5. Do not reimplement completed work. Make only remaining, concrete fixes that are small enough to finish in a few days and help demonstrate a reliable React + Express + MongoDB CRUD application.

Check that the frontend, backend, API routes, validation, summary calculations, MongoDB configuration, README setup steps, and test commands agree with each other. Verify create/list/update/delete and summary behavior using isolated test data, never by editing or deleting my normal database records. Verify the frontend production build and backend test suite. If local MongoDB is unavailable, report that as an environment limitation and still run all checks that do not need it.

Do not add authentication or unrelated features. Do not delete or rename working files unnecessarily. First report the remaining issues and proposed order; then implement only the approved-by-scope minimal fixes, verify them, and finish with a short prioritized checklist of anything still optional.
```

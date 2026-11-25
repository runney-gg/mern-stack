# SpendWise QA Status and Comparison Notes

Updated after rerunning the available automated checks on 2026-11-25. This report separates current results from earlier manual QA observations and environment limitations.

## Current verification results

| Check | Result | Notes |
|---|---|---|
| Backend suite | **19 passed, 0 failed** | Includes validation, filters, security middleware, transaction CRUD, summaries, invalid/missing IDs, and database-unavailable behavior. HTTP tests used the guarded local `spendwise_test` database. |
| Frontend tests | **12 passed, 0 failed** | Includes form/list interactions, dashboard mutation refresh, filters/load errors, and Retry recovery. |
| Frontend production build | **Passed** | Vite production bundle generated successfully. |
| Postman collection structure | **Passed** | JSON parsed successfully; 19 requests and 19 test scripts found. The Postman scripts were not executed in Postman/Newman in this run. |
| `git diff --check` | **Passed** | No whitespace errors. |

The backend integration suite cleared only records in its isolated `spendwise_test` database. The configured normal SpendWise database and its records were not accessed for destructive checks.

## Fix and test added in this rerun

The old report listed Retry-button recovery as unchecked. I added a Dashboard test that makes the first health request fail, clicks Retry, lets the next request succeed, and verifies the error notice clears. It passes with the other frontend tests. This is test-only; no application behavior was changed for the Retry flow.

## Current limitations

1. **Postman runtime execution:** Newman/Postman is not installed in this environment. The collection was structurally checked, and its CRUD/validation behaviors are covered by the passing backend HTTP tests, but the collection's own `pm.test` scripts have not been executed by Postman. To run it later, import `postman/SpendWise.postman_collection.json` into Postman and point it at an API connected to an isolated QA database. Do not use the personal database.

2. **Interactive browser/responsive checks:** No browser automation surface was available in this rerun, so I did not repeat the previous Chrome visual checks at 759px, 539px, and 375px, nor manually inspect console output. Earlier QA notes reported those checks passing. Current frontend interaction tests and production build pass, but they are not a substitute for a fresh visual browser pass.

3. **Live local health/browser retry:** The new Dashboard test verifies Retry behavior using mocked API helpers. I did not launch another live browser session or make read/write requests against the normal database. The backend integration suite independently verifies database-unavailable responses using its test setup.

## Earlier QA observations retained for context

- Earlier restricted-shell attempts to access localhost returned `EPERM`/connection refused. In this rerun, the backend HTTP tests succeeded with permitted local MongoDB and loopback access.
- An earlier second-`mongod` attempt hit `DBPathInUse` because an existing MongoDB process held the data directory. No lock file was removed and no second process was forced onto the same data path.
- Earlier browser QA covered dashboard rendering, create/edit/delete, summaries, filters, empty states, and several mobile widths using isolated QA records. Those historical checks were reported as passing and cleaned up; they were not repeated this run.

## Course reference comparison

**Reference:** user-provided `Mern-main.zip`, inspected read-only after extracting to `/tmp`.

The archive is a basic books/products CRUD teaching app. It has `frontend/` and capitalized `Backend/`, some frontend files at the app root and a singular `src/component/`, plus backend singular `controller/`, `schema/`, and `connectToDb/` folders. Its Express `index.js` combines startup and app wiring; its Mongo URI is hard-coded as `mongodb://localhost:27017/mern`. The shown React components call Axios directly using hard-coded `http://localhost:8000/product` URLs. Its Book handlers implement CRUD with direct Mongoose calls; the listed tree contains no automated tests.

SpendWise instead has lowercase `frontend/` and `backend/`, separated frontend API/components/pages, backend config/model/controller/routes/utilities, environment-based Mongo configuration, and transaction-specific CRUD, filters, pagination, summaries, charts, validation, error states, and automated tests. The reference is useful for learning the basic form → route → controller → model flow; copying its structure or hard-coded settings would be a regression for SpendWise. The archive's folder names and README describe a lesson sample, not a requirement that SpendWise should adopt its books/products domain or extra dependencies.

### Safe learning prompts recorded from the comparison

These are optional prompts, not a checklist of required code changes:

1. **README data flow:** Trace the React transaction form → API helper → Express route/controller → Mongoose model → MongoDB → dashboard refresh. Use current filenames and change documentation only.
2. **CRUD response contract:** Check status codes and response shapes for create/list/update/delete, invalid IDs, and missing records. Change only a confirmed mismatch while preserving the frontend and Postman contract; test against the isolated database.
3. **API centralization:** Search for direct frontend network calls and hard-coded API hosts. Move only a confirmed exception into the existing helper; preserve filters, errors, refresh behavior, and tests.
4. **Model validation coverage:** Compare parser and schema rules. If a rule can be bypassed by a direct Mongoose write, add the smallest schema guard and isolated test without changing existing records.

### Outcomes of those prompts in the current project

- Prompt 1 was completed in `README.md` as a documentation-only update.
- Prompt 2 found no response contract inconsistency. Route tests were strengthened to assert response shapes; the current backend suite passes.
- Prompt 3 found no direct network request outside the existing API helper. The localhost URL is only the Vite proxy target. No code change was needed; frontend tests/build pass.
- Prompt 4 found that two-decimal precision was enforced by the input parser but not the Mongoose schema. A schema-level validator and focused test were added; the current backend suite passes.

## Recommended remaining steps

1. Optionally run the Postman collection in Postman against a separate QA database.
2. Optionally repeat a visual browser pass at desktop and mobile widths, including a browser-console check.
3. Keep the local MongoDB service to one process per data directory; never remove a live MongoDB lock file manually.

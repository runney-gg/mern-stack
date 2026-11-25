# SpendWise QA Failures and Limitations

This report records the failures and incomplete checks observed during QA. It distinguishes confirmed application defects from environment or test-coverage issues.

## Confirmed application test failures

None found in the available automated checks.

- Backend automated tests: **6 passed, 0 failed**.
- Frontend production build: **passed**.
- Read-only API checks against the running application: health, summary, and month-filtered transaction listing returned successful responses.
- The earlier isolated REST/MongoDB QA flow passed CRUD, filtering, summaries, validation, unavailable-database handling, and persistence checks. Its test records were cleaned up.

## Failures and limitations observed

### 1. Localhost checks initially returned `EPERM` or connection refused — addressed

**Observed:** The restricted QA shell could not access `127.0.0.1:27017`, `:5001`, or `:5173`. Mongo shell reported `connect EPERM`; curl reported connection refused.

**Root cause:** Localhost access is blocked for ordinary commands in the QA sandbox. This was a test-runner restriction, not an application outage.

**Resolution and verification:** Re-ran read-only checks with permitted localhost access. MongoDB ping returned `{ ok: 1 }`, `GET /api/health` returned HTTP 200 with `database: "connected"`, and the Vite frontend returned HTTP 200. No application source change was needed.

If this same restriction appears when running checks from the QA environment, use a terminal/process with localhost access. From a regular project terminal, confirm the services with:

```sh
curl http://127.0.0.1:5001/api/health
curl http://127.0.0.1:5173/
```

Expected API health response includes `"status":"ok"` and `"database":"connected"` when MongoDB is available.

### 2. A second MongoDB process could not use the project data directory — addressed

**Observed:** Starting `mongod` with `backend/.mongo-data` returned `DBPathInUse` because another MongoDB process already held the directory lock.

**Root cause:** A MongoDB process was already using the project's data directory. Concurrent `mongod` processes cannot safely share one `dbPath`.

**Resolution and verification:** Left the existing MongoDB process alone. A read-only MongoDB ping returned `{ ok: 1 }`, and the API health endpoint reported `database: "connected"`. No data directory or lock file was removed.

If MongoDB needs a restart later, stop its existing process cleanly before starting one `mongod` with `backend/.mongo-data`.

### 3. Interactive frontend checks — core flows and responsive checks addressed

**Verified in Chrome:** Dashboard and chart rendering against both existing data and an empty QA database; client-side amount validation; adding NPR 30,000 income and NPR 5,000 expense; updated NPR 25,000 balance; editing the expense to NPR 4,000 and updated NPR 26,000 balance; delete confirmation and refreshed totals; search result and no-results empty state. The create/edit/delete checks used a separate QA database, and the records were removed afterward. No records in the existing personal database were changed.

The REST flow verified month, type, search, and date-range filtering. In Chrome device emulation, I inspected the dashboard at 759px, transaction cards and form at 539px, and the page/form at 375px. Mobile transaction rows expose their field labels and the layout remains navigable at these widths. In Transactions, selecting `2026-11` displayed the two November QA records and excluded the October record.

To check API error handling, I stopped the isolated API and confirmed `127.0.0.1:5002/api/health` refused the connection. Chrome displayed the API error state and a Retry button. I restarted the API against isolated database `spendwise_responsive_qa_20261109`; health returned `{"status":"ok","database":"connected"}`. Three tagged test records were deleted and a search confirmed the isolated test dataset is empty. I could not reliably verify that clicking Retry cleared the browser error state after recovery. No personal database records were changed.

**Remaining check:** With the isolated API available on port 5002 and preview on port 5174, select Retry after a transient API failure and confirm the error banner clears. Avoid destructive testing against the personal database.

### 4. Postman collection execution — API flow addressed; Newman runner remains unavailable

**Verified:** The collection parses and contains 19 requests with 19 test scripts. Since neither Postman nor Newman is installed in this environment, I executed the equivalent 19-request CRUD/filter/summary/validation/cleanup flow using Node's built-in `fetch` against a temporary isolated API and database. All 19 assertions passed, and the isolated database was empty afterward. No dependency was installed.

**Remaining limitation:** The collection's Postman `pm.test` scripts themselves have not been executed by the Postman runtime.

**How to finish:** Import `postman/SpendWise.postman_collection.json` into Postman and run it against the local API, or use Newman when available:

```sh
npx --yes newman run postman/SpendWise.postman_collection.json
```

Run with the API connected to a QA database, not the personal data database. The final collection requests clean up the tagged records; if a run is interrupted, run the cleanup requests before rerunning.

## Recommended next steps

1. Keep one MongoDB process running against `backend/.mongo-data`.
2. Complete the Retry-button recovery check described above.
3. Run the Postman collection in Postman/Newman to execute its `pm.test` scripts.
4. If any remaining check produces an application error, capture the exact request, response, or browser-console message and fix that reproducible issue.

# SpendWise

SpendWise is a personal income and expense tracker built as a small MERN stack college project. The React/Vite frontend is in `frontend/`; the Express API and Mongoose model are in `backend/`.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MongoDB running locally or a MongoDB connection URI

## Setup

Install dependencies in both applications:

```sh
cd backend && npm ci
cd ../frontend && npm ci
```

Direct dependencies are pinned to exact versions and both applications include lockfiles, so `npm ci` installs the recorded dependency tree.

The local `backend/.env` uses MongoDB at `mongodb://127.0.0.1:27017/spendwise`. Change `MONGODB_URI` if needed. The frontend uses the Vite `/api` proxy to reach `http://127.0.0.1:5001`; set `SPENDWISE_API_URL` in `frontend/.env` to override the proxy target. Example files are provided in both application folders.

Start the backend from one terminal:

```sh
cd backend
npm run dev
```

For a local MongoDB URI (`127.0.0.1`, `localhost`, or `::1` on port `27017`), this command starts MongoDB from the local Homebrew config when it is not already running, waits for it to accept connections, and then starts the API. If MongoDB is already running, it reuses that process. Press Ctrl+C to stop the API and any MongoDB process this command started. The MongoDB config is detected at `/opt/homebrew/etc/mongod.conf` or `/usr/local/etc/mongod.conf`; set `MONGOD_CONFIG` if yours is elsewhere. `npm run dev:api` (or `npm start`) runs only the API.

Start the frontend in a second terminal:

```sh
cd frontend
npm run dev
```

Open the Vite URL shown in the frontend terminal, usually http://localhost:5173. Check the API at http://127.0.0.1:5001/api/health. The API binds to loopback (`127.0.0.1`) and is intended for local development only. Run backend tests with `npm test`, or build the frontend with `npm run build`.

## API

- `GET /api/health` — process and database status
- `GET /api/transactions` — list transactions; optional query parameters: `page` (default `1`, maximum `10000`), `limit` (default `20`, maximum `100`), `month=YYYY-MM`, `startDate=YYYY-MM-DD`, `endDate=YYYY-MM-DD`, `type=income|expense`, `category=...`, and `search=...` (matches category or description). Filters can be combined. The response remains an array; pagination totals and the effective page are returned in `X-Total-Count`, `X-Page`, `X-Limit`, and `X-Total-Pages` headers.
- `POST /api/transactions` — create a transaction (`type`, `amount`, `category`, `date`; optional `description`)
- `PUT /api/transactions/:id` — update one or more transaction fields
- `DELETE /api/transactions/:id` — delete a transaction
- `GET /api/summary` — totals, balance, expense totals by category, and monthly income/expense rows. Accepts the same filters as the transaction list.

When MongoDB is unavailable, the API still starts in degraded mode and health reports `database: "disconnected"`. Database-backed routes return HTTP 503 while MongoDB is unavailable. If `MONGODB_URI` is configured, the API retries the connection every 10 seconds and database routes become available automatically after MongoDB returns. If `MONGODB_URI` is missing, add it to `backend/.env` and restart the API.

## Local demo boundary and input limits

SpendWise is a single-user local demo with no authentication or authorization. The API listens only on `127.0.0.1`. Browser CORS allows the default Vite origin (`http://localhost:5173`) and an optional `CLIENT_ORIGIN` only when it is itself a loopback origin. Keep MongoDB local as well. Do not expose or port-forward the API or database to a network; this project is not intended to be deployed as a public service.

The API accepts JSON request bodies up to 16 KB. Transaction amounts must be from `0.01` through `1,000,000,000`, with no more than two decimal places. Categories are limited to 100 characters, descriptions to 500 characters, and category/search filters to 100 characters. Invalid values receive HTTP 400; oversized JSON receives HTTP 413. These limits are enforced by the API before database writes.

## Data flow and tests

### Transaction request flow

When a user submits the add/edit form in `frontend/src/components/TransactionForm.jsx`, the component checks the required amount, category, and date, builds a JSON transaction, and calls `createTransaction()` or `updateTransaction()` from `frontend/src/api/transactions.js`. That helper sends `POST /api/transactions` or `PUT /api/transactions/:id`; it uses the same-origin `/api` path by default, which the Vite proxy forwards to the backend at `http://127.0.0.1:5001`.

In `backend/src/app.js`, Express mounts the transaction router at `/api/transactions`. `backend/src/routes/transactionRoutes.js` checks database availability and maps the HTTP method/path to a controller in `backend/src/controllers/transactionController.js`. The controller parses and validates the submitted fields with `parseTransactionInput()`, then creates or updates a document with the Mongoose `Transaction` model in `backend/src/models/Transaction.js`. Mongoose persists the document to the database selected by `MONGODB_URI`.

The create controller responds with HTTP 201 and the created transaction as JSON; update responds with HTTP 200 and the updated transaction. The frontend helper parses successful JSON and throws a readable error for network, invalid JSON, or non-2xx responses. On success, `TransactionForm.jsx` calls `onSaved()`. The dashboard in `frontend/src/pages/Dashboard.jsx` closes the dialog and increments its refresh key, which reloads the recent transaction list and summary API data so the list, totals, and charts reflect the mutation. Delete uses `deleteTransaction()` in the same API helper; after deletion, the dashboard refreshes its data as well.

MongoDB connection is configured in `backend/.env` and initialized by `backend/src/server.js` through `backend/src/config/db.js`. The server binds to `127.0.0.1:5001`; if MongoDB is down, the API starts in degraded mode and retries the connection.

The short version is: **React form → API helper → Express route → controller/validation → Mongoose model → MongoDB → JSON response → dashboard refresh.**

Run backend tests from the project root with `npm test` (or from `backend/` with `npm test`). The suite includes validation/filter unit tests and HTTP API tests for transaction CRUD, filters, summaries, and database-unavailable responses. The HTTP tests need the local MongoDB configured in `backend/.env`; they use the separate `spendwise_test` database and clear its transaction records before and after the suite. The test setup refuses to run against a remote MongoDB host or if the configured application database is named `spendwise_test`. If MongoDB is not reachable, the integration tests fail with an explicit setup message rather than being skipped. Your normal `spendwise` database is not used by these tests.

Run the frontend interaction tests from the project root with `npm run test:frontend` (or from `frontend/` with `npm test`). They cover transaction form validation/submission, dialog keyboard focus behavior, transaction edit/delete actions, loading/error/empty-list states, and Dashboard summary/recent-list refresh after create, update, and delete. These tests do not need a backend or database. Build the frontend with `npm run build` from the project root.

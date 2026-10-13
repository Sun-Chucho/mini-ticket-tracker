# Mini Ticket Tracker

A small support ticket app for Lodwar Services. The backend is an Express REST API, the database is PostgreSQL, and the single-page UI is built with React and Vite.

## Requirements

- Node.js 20 or newer
- Docker Desktop (for the local PostgreSQL service), or an existing PostgreSQL database

## Setup and run

1. Copy `.env.example` to `.env`. Change `DATABASE_URL` if your PostgreSQL connection differs from the local default.
2. Start PostgreSQL with `docker compose up -d database`.
3. Install dependencies with `npm install`.
4. Start the API and UI with `npm run dev`.
5. Open the Vite URL printed in the terminal (usually `http://localhost:5173`). The API listens on `http://localhost:3001`.

The API creates its table and index on startup. For a production deployment, run schema changes through a migration tool and set `DATABASE_URL` and `PORT` in the service environment. Run `npm run build` followed by `npm start` to serve the built UI and API from one process. The API also exposes `GET /health`, which checks database connectivity.

## API

- `POST /tickets` — create a ticket with a required title and optional description and priority.
- `GET /tickets?status=open&page=1&limit=20` — list tickets with an optional status filter and pagination. The response contains `tickets`, `page`, `limit`, and `total`.
- `PATCH /tickets/:id` — update a ticket's `status`, `priority`, or both.
- `GET /tickets/stats` — return counts for `open`, `in_progress`, and `closed`.

Statuses are `open`, `in_progress`, and `closed`; priorities are `low`, `medium`, and `high`. Titles are limited to 160 characters, descriptions to 5,000 characters, and page size to 100.

## Tests

Run `npm test` for API tests covering creation and input handling, filtered pagination, status counts, and ticket updates. The tests exercise Express routes with a lightweight database stub; they do not require a running PostgreSQL server.

## Decisions & Tradeoffs

I chose Express and PostgreSQL to keep the API direct and the stored data durable. The database initializes its small schema at startup to avoid adding a migration framework for this assignment. The list endpoint returns a total count alongside one page so the UI can show simple pagination. I capped page size and input lengths to keep requests bounded. The API tests use a stubbed query interface, which keeps them quick but does not verify PostgreSQL's SQL behavior against a live server. I kept the interface to one page and limited ticket updates to status and priority, as requested. With more time, I would add database-backed integration tests, migrations, authentication, and stronger observability. I would also add editing and deletion only after confirming the support team's workflow.

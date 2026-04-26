# TicketRush

An event ticket booking platform with real-time seating maps, flash-sale
concurrency handling, and a virtual queue system.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + Zustand + TanStack Query
- **Backend**: FastAPI + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL + Redis
- **Infra**: Docker Compose (PostgreSQL, Redis)

## Quick start

### 1. Start datastores

```bash
docker compose up -d
cd backend
uv run alembic upgrade head
uv run python -m scripts.seed_admin admin@example.com admin12345 "Admin"
uv run python -m scripts.seed_demo  # optional
```

Postgres runs on `localhost:5433`, Redis on `localhost:6380` (remapped to avoid
clashing with any local install of the same services).

### 2. Backend

```bash
cd backend
cp .env.example .env            # set JWT_SECRET_KEY in production
uv venv
uv sync
uv run alembic upgrade head     
uv run uvicorn app.main:app --reload
```

OpenAPI docs: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
cp .env.example .env
pnpm install
pnpm dev
```

App: http://localhost:5173 (Vite dev server proxies `/api/*` to the backend)


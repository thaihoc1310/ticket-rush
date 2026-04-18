# TicketRush

An event ticket booking platform with real-time seating maps, flash-sale
concurrency handling, and a virtual queue system.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + Zustand + TanStack Query
- **Backend**: FastAPI + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL + Redis
- **Infra**: Docker Compose (PostgreSQL, Redis)

## Phase 1 scope

Project scaffolding and authentication:

- Docker Compose for PostgreSQL (5433) and Redis (6380)
- FastAPI app with async DB session, Redis pool, CORS, OpenAPI docs
- `User` and `Venue` SQLAlchemy models + Alembic migrations
- Auth: register / login / refresh / logout / me with JWT access tokens
  (bearer) and refresh tokens (HTTP-only cookie)
- Role-based dependency guards (`get_current_user`, `require_admin`)
- Frontend: Login/Register pages, protected-route wrapper, AppShell layout,
  auth store, API client

## Quick start

### 1. Start datastores

```bash
docker compose up -d
```

Postgres runs on `localhost:5433`, Redis on `localhost:6380` (remapped to avoid
clashing with any local install of the same services).

### 2. Backend

```bash
cd backend
cp .env.example .env            # set JWT_SECRET_KEY in production
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

## Project layout

```
ticket-rush/
├── docker-compose.yml
├── backend/
│   ├── alembic/                # migrations
│   └── app/
│       ├── main.py             # FastAPI factory
│       ├── config.py           # pydantic-settings
│       ├── database.py         # AsyncEngine + session
│       ├── redis.py            # redis.asyncio pool
│       ├── models/             # SQLAlchemy models
│       ├── schemas/            # Pydantic request/response
│       ├── routers/            # FastAPI routers
│       ├── services/           # Business logic
│       ├── dependencies/       # Depends() helpers
│       └── utils/              # security.py, enums
└── frontend/
    └── src/
        ├── components/         # ui, layout
        ├── pages/              # auth, public
        ├── routes/             # ProtectedRoute
        ├── services/api.ts     # fetch wrapper
        ├── store/              # zustand
        ├── hooks/              # useAuth
        └── types/
```

## Next phases

- **Phase 2**: Events, Venues, Zones CRUD + Seat Matrix Editor
- **Phase 3**: Seating map + two-layer seat locking + checkout + QR tickets
- **Phase 4**: Admin dashboard + analytics + polish
- **Phase 5**: Redis-backed virtual queue with dual-signal auto-activation

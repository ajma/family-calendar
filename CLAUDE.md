# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Calendar is a web app that unifies multiple Google Calendars into a single weekly view with a Presentation Mode for family discussions. It uses Google OAuth for authentication and stores settings in SQLite.

## Commands

```bash
npm run dev              # Run frontend (Vite on :5173) + backend (Express on :3001) concurrently
npm run dev:frontend     # Vite dev server only
npm run dev:backend      # Express backend only (tsx watch)
npm run build            # Build frontend (vite build → dist/) + server (esbuild → dist-server/)
npm run lint             # ESLint
npm run test             # vitest run (all tests)
npx vitest run path/to/file  # Run a single test file
```

## Architecture

**Three-layer structure:**
- `web/` — React frontend (Vite, vanilla CSS, no UI framework)
- `server/` — Express backend (TypeScript, ESM)
- `common/` — Shared TypeScript types (`types.ts`) used by both

**Path aliases:** `@/*` → `web/*`, `common/*` → `common/*` (configured in both tsconfig.json and vite.config.ts)

### Backend (`server/`)
- `index.ts` — Express app setup, serves API routes and static frontend in production
- `routes/auth.ts` — Google OAuth code exchange, JWT session creation
- `routes/settings.ts` — CRUD for user calendar configs, people, appearance
- `routes/calendar.ts` — Proxies Google Calendar API (calendar list + events)
- `middleware/auth.ts` — JWT session auth with Cloudflare Access header fallback
- `db.ts` — SQLite via `sqlite`/`sqlite3` with inline migrations; DB file at `data/database.sqlite`
- `crypto.ts` — Encrypts/decrypts stored OAuth tokens using `TOKEN_ENCRYPTION_KEY`
- `services/eventService.ts` — Event processing logic

### Frontend (`web/`)
- `CalendarContext.tsx` — Central React context managing all app state (events, calendars, people, settings)
- `App.tsx` — Root component, handles auth flow
- Key components: `WeekGrid`, `DayColumn`, `EventCard`, `CalendarHeader`, `PresentationControls`, `SettingsModal`, `AttendeeEditor`, `CalendarSelectorModal`
- `hooks/usePresentationMode.ts` — Keyboard-driven presentation mode
- `services/backend.ts` — API client for server communication
- `utils/` — Event annotation/enrichment logic

### Auth Flow
1. Frontend uses `@react-oauth/google` auth-code flow
2. Server exchanges code for tokens, stores encrypted refresh token in SQLite
3. Server issues a JWT session token for subsequent requests
4. Optional Cloudflare Access header auth (disable with `DISABLE_CLOUDFLARE_AUTH=true`)

## Testing

- Framework: Vitest with jsdom environment
- Setup file: `tests/setup.ts`
- Backend tests: `server/__tests__/`
- Frontend tests: `web/__tests__/`, `web/components/__tests__/`, `web/services/__tests__/`
- Uses `@testing-library/react` for component tests, `supertest` for API tests
- Test DB uses `database.test.sqlite` (separate from dev)

## Environment Variables

Required in `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`, `TOKEN_ENCRYPTION_KEY` (64-char hex), `JWT_SECRET`

Optional: `DISABLE_CLOUDFLARE_AUTH=true`, `PORT` (default 3001 dev, 5173 production)

## Development Workflow

Per `.agents/workflows/DEVELOPMENT.md`: for significant changes, create/update tests, run `npm run test`, and update `docs/TESTS.md` with new test cases and counts.

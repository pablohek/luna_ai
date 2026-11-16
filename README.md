# LUNA AI

LUNA AI is a menstrual cycle journal built with React, TypeScript, Vite, Tailwind CSS, FastAPI and PostgreSQL. It includes registration, sign-in, an account-scoped dashboard, a selectable calendar, ongoing and completed period logs, daily mood and symptom check-ins, cycle analytics, profile settings, JSON export and password-confirmed account deletion.

The dashboard uses a **statistical calendar baseline**. It waits for three period starts, then uses the median of the last two to six start-to-start intervals. The window extends on both sides of the midpoint by the largest observed deviation from that median, with a three-day minimum. If the window has passed, the dashboard prompts you to update the log. The range has no calibrated probability. It can be wide when entries are missed or cycles vary. It cannot determine fertility or guide contraception.

## Windows and VS Code

Install **Node.js 24 LTS**, **Python 3.12**, **VS Code** and **Docker Desktop** set to use Linux containers. Extract the ZIP, use **File → Open Folder** to open the inner `luna-ai` folder, and start Docker Desktop. All commands below use VS Code's PowerShell terminal.

### 1. Start PostgreSQL

From the project root:

```powershell
Copy-Item .env.example .env
docker compose up -d --wait db
```

If you already run PostgreSQL locally, you can create a dedicated database and login role there and edit `LUNA_DATABASE_URL` in `.env`. If Docker reports that host port 5432 is in use, change the host port in `compose.yaml` and use the same port in `.env`.

### 2. Start FastAPI

In the same terminal:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
Set-Location backend
..\.venv\Scripts\python.exe -m luna.db
..\.venv\Scripts\python.exe -m uvicorn luna.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

The migration command is safe to rerun. The explicit Python executable avoids PowerShell activation policy changes. Leave the backend running.

### 3. Start the React frontend

Open a second terminal from the project root:

```powershell
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and create a test account. Keep `localhost` in the browser address. The API validates the browser's exact origin on write requests. To see an estimate immediately, log three non-overlapping completed periods whose starts were approximately 73, 45 and 17 days ago.

Stop the two processes with **Ctrl+C** and stop PostgreSQL with `docker compose stop db`. The Compose volume preserves records between restarts.

The earlier browser-only starter stored records in that browser. Existing starter records remain there and can be re-entered manually. This release stores journal data in PostgreSQL.

## Tests

Use synthetic records and a disposable database. For the backend PostgreSQL integration tests, open a fresh PowerShell terminal at the project root and create `luna_test` once:

```powershell
docker compose exec -T db createdb -U luna luna_test
$env:LUNA_TEST_DATABASE_URL = "postgresql://luna:local-luna-password@127.0.0.1:5432/luna_test"
$env:LUNA_DATABASE_URL = $env:LUNA_TEST_DATABASE_URL
Set-Location backend
..\.venv\Scripts\python.exe -m pytest -q
```

The test run applies migrations to that database. With no `LUNA_TEST_DATABASE_URL`, only the prediction tests run.

With the development API running against a disposable database, test Chromium from the project root in another terminal. Playwright starts Vite if it is absent.

```powershell
npm run build
npx playwright install chromium
npm test
```

The browser suite registers a synthetic account and deletes it on success. A failed test can leave synthetic records in the test database.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | Landing, account screens, calendar, journal and privacy controls |
| `backend/luna/` | API, request schemas, database access and forecast baseline |
| `backend/migrations/` | Ordered PostgreSQL schema migrations |
| `backend/tests/` | Prediction and PostgreSQL API tests |
| `tests/` | Playwright browser coverage |
| `docs/LAUNCH.md` | Deployment configuration and public launch work |
| `docs/ML.md` | Data and evaluation requirements for a future model |

## Verification for this release

| Phase | Result |
| --- | --- |
| Environment | npm dependencies installed from the lockfile. Python dependency consistency check passed. |
| Database and API | Migrations applied to PostgreSQL 18. All 10 prediction and API tests passed in development and production configuration. |
| Frontend | TypeScript and Vite production build passed. |
| Browser | Playwright passed the account, calendar and journal workflow in headless Chromium. The test exercised 375 px and 1280 px layouts. |
| Launch | Deployment remains pending. Windows setup is documented and the tests were run on Linux. |

## Public hosting

The project includes a production Dockerfile for hosting the frontend and API together, plus a Render deployment guide. Read [docs/RENDER_DEPLOY.md](docs/RENDER_DEPLOY.md) before creating hosting resources. Public hosting requires a private source repository, a hosted PostgreSQL database with a suitable retention plan, and production secret settings.

## Vercel and Neon

For a personal, non-commercial demo using Vercel Services and Neon, see [docs/VERCEL_DEPLOY.md](docs/VERCEL_DEPLOY.md). It serves React and FastAPI under one HTTPS origin. The free hosting plans have usage limits, and Vercel Services and its Python runtime are beta.

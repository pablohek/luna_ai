# Vercel and Neon deployment

This project deploys the Vite frontend and FastAPI backend as two Vercel services under one HTTPS origin. The frontend sends same-origin `/api/*` requests to FastAPI, so the session cookie and exact-origin checks use the same site. PostgreSQL is hosted by Neon.

Vercel Services and its Python runtime are in beta. Vercel Hobby is for personal, non-commercial use. This is a personal demo setup, not a completed public-health-data launch.

## Repository configuration

The root `vercel.json` defines the `app` Vite service and `backend` FastAPI service. It sends `/api/*` requests to FastAPI and all other paths to Vite. The FastAPI service starts at `backend/index.py` and installs `backend/requirements.txt`. Keep `.env` out of Git.

## Deploy on Vercel

1. In Vercel, create a project from `pablohek/luna_ai` and keep the repository root as the project root.
2. Select the **Services** framework preset. Confirm the project uses the repository's `vercel.json` and that it detects both the `app` Vite service and the `backend` FastAPI service.
3. Create a Neon PostgreSQL project in a nearby region. Choose the pooled connection string for the default database and keep it private.
4. In Vercel **Project → Settings → Environment Variables**, add these production variables:

| Name | Value |
| --- | --- |
| `LUNA_MODE` | `production` |
| `LUNA_DATABASE_URL` | Neon pooled PostgreSQL connection string with TLS enabled |
| `LUNA_RATE_SECRET` | A new random secret, for example from `py -c "import secrets; print(secrets.token_urlsafe(48))"` |

Never commit or paste the database URL or rate secret into source code. `VERCEL_URL` provides the deployment hostname used to check the origin. If you later use a custom domain, set `LUNA_ORIGIN` to its exact HTTPS origin.

5. Run the initial database migration once, before testing accounts. From PowerShell at the project root, set `LUNA_DATABASE_URL` to the Neon connection string in that terminal, enter `backend`, then run `..\.venv\Scripts\python.exe -m luna.db`. This migration needs a database role with schema-migration privileges. The application itself should use a least-privilege role where the database provider allows it.
6. Start the first deployment. Check the Vercel build output for both services and then test `/api/health`, registration, sign-in, period logging, check-ins, export, and account deletion with synthetic records.

Database migrations do not run automatically during application startup. If the schema has not been initialized, the health check and app will fail until you apply the migration.

## Free-plan limits and launch readiness

Vercel Hobby and Neon Free have usage and suitability limits that can change. Neon may pause its free database when idle; a first request can be slower. Check the providers' current plan pages before relying on the free deployment. Use synthetic records until you complete the privacy, retention, backup, account recovery, and security work listed in [LAUNCH.md](LAUNCH.md).

References:

- [Vercel Services](https://vercel.com/docs/services)
- [Vercel FastAPI](https://vercel.com/docs/frameworks/backend/fastapi)
- [Neon plans](https://neon.com/docs/introduction/plans)

# Vercel and Neon deployment

This setup serves the React build and FastAPI routes through one Vercel HTTPS origin, so the session cookie and exact-origin checks use the same site. It uses Neon for PostgreSQL. Vercel's Python runtime is currently in beta. Vercel Hobby is for personal, non-commercial use.

## Current repository access

The GitHub repository is `pablohek/luna_ai`. The Vercel deployment needs the complete project committed to its default branch. Keep `.env` out of Git. The `.gitignore` excludes it.

## Deploy on Vercel

1. Sign in to Vercel, choose **Add New → Project**, and import `pablohek/luna_ai`.
2. Set the **Root Directory** to the repository root. Keep Framework Preset on **Other** so the root FastAPI entry point can serve both the API and built frontend.
3. Keep the repository's `vercel.json` build command. Do not select a separate output directory.
4. Create a Neon project in Singapore. In its connection details, select the pooled connection string for the default database.
5. In Vercel, open **Project → Settings → Environment Variables** and add:

| Name | Value |
| --- | --- |
| `LUNA_MODE` | `production` |
| `LUNA_DATABASE_URL` | Neon pooled PostgreSQL connection string, including `sslmode=require` |
| `LUNA_RATE_SECRET` | A new random secret from `py -c "import secrets; print(secrets.token_urlsafe(48))"` |

Keep the secret in Vercel's environment settings. Do not commit it or paste it into source files. The application reads Vercel's production `VERCEL_URL` to validate the public origin and require Secure cookies. Set a custom `LUNA_ORIGIN` only if you connect a custom domain.

6. Deploy. The container-free application startup runs the ordered database migration before serving requests.
7. Open the production URL and test registration, sign-in, period logging, check-ins, export, and account deletion with synthetic records.

## Free-plan behavior

Neon's Free plan currently includes 1 GB PostgreSQL storage and 100 compute-hours per project per month. Database compute scales to zero after five minutes of inactivity, so the first request after a pause can be slower. Reaching the compute allowance suspends compute until the monthly quota resets. Data remains stored. Vercel Hobby is intended for personal, non-commercial projects. This setup is suitable for a personal demo. Confirm current provider limits before relying on it for actual health records.

References:

- Vercel FastAPI: https://vercel.com/docs/frameworks/backend/fastapi
- Vercel Python runtime: https://vercel.com/docs/functions/runtimes/python
- Neon Free plan: https://neon.com/docs/introduction/plans

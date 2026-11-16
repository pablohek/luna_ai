# Put LUNA AI online with Render

This repo is configured to serve the built React app and FastAPI API from one HTTPS origin. The PostgreSQL database stays on Render's private network. Check the current plan and database retention terms in Render before creating resources.

## 1. Push a private GitHub repository

Create a **private** repository in your GitHub account. From PowerShell in the project folder, run:

```powershell
git init
git add .
git commit -m "Prepare LUNA AI for deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/luna-ai.git
git push -u origin main
```

If Git asks, sign in through Git Credential Manager. Do not add `.env` to Git. The `.gitignore` and `.dockerignore` files already exclude it.

## 2. Create the database

In Render, create a PostgreSQL database in the same region as the web service. Choose a plan that remains available for user records and backups. Copy the **internal** connection string for use by the web service. Do not enable public database access.

## 3. Create the web service

Choose **New → Web Service**, connect the private `luna-ai` repository and set:

- Runtime: Docker
- Dockerfile path: `./Dockerfile`
- Docker build context: repository root
- Health check path: `/api/health`

In the service environment settings, add:

| Key | Value |
| --- | --- |
| `LUNA_MODE` | `production` |
| `LUNA_DATABASE_URL` | Internal connection string for the Render PostgreSQL database |
| `LUNA_RATE_SECRET` | A newly generated secret, at least 32 characters |

Generate the rate secret locally using `py -c "import secrets; print(secrets.token_urlsafe(48))"` and paste it directly into the service's secret environment variable. The service reads Render's `RENDER_EXTERNAL_URL` as its exact public origin. It sets HTTPS-only session cookies in production. Do not use the sample `LUNA_ORIGIN` or local database URL for production.

## 4. Deploy and check

Deploy the service, wait for the health check to pass, then open its HTTPS URL. Register a synthetic account and verify sign-in, period logging, check-ins, export and account deletion. Use your own account only after confirming these work. Share the HTTPS URL with visitors. The account signup is public to anyone who has the URL, so do not add real menstrual records until you intend to operate the service for real users.

## 5. Keep it maintained

Use a managed database plan with backups and review the provider's retention and restore procedures. Configure a separate staging service and staging database for tests. Do not run the integration or browser test suite against the production database. Review applicable privacy and health-data requirements before promoting the service to public use.

Render's web service guide: https://render.com/docs/deploy-fastapi
Render environment secrets: https://render.com/docs/configure-environment-variables

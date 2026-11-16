# Build Vite assets locally into the same image that serves the FastAPI API.
FROM node:24-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
RUN npm run build

FROM python:3.12-slim AS application
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/luna ./backend/luna
COPY backend/migrations ./backend/migrations
COPY --from=frontend /app/dist ./dist
ENV PYTHONPATH=/app/backend
CMD ["sh", "-c", "python -m luna.db && uvicorn luna.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]

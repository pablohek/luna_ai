"""Vercel's FastAPI entrypoint. The application serves the built frontend too."""

from backend.luna.main import app

__all__ = ["app"]

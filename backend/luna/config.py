import os
from pathlib import Path
from urllib.parse import urlsplit


def load_environment():
    path = Path(__file__).resolve().parents[2] / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.strip().partition("=")
            if sep and key and not key.startswith("#"):
                os.environ.setdefault(key, value.strip())


load_environment()
MODE = os.environ.get("LUNA_MODE", "development")
vercel_host = os.environ.get("VERCEL_URL")
platform_origin = (
    f"https://{vercel_host}" if vercel_host else os.environ.get("RENDER_EXTERNAL_URL")
)
ORIGIN = os.environ.get("LUNA_ORIGIN") or platform_origin or "http://localhost:5173"
DSN = os.environ.get("LUNA_DATABASE_URL", "")
RATE_SECRET = os.environ.get("LUNA_RATE_SECRET", "local-development-only").encode()
if MODE not in {"development", "production"}:
    raise RuntimeError("Invalid LUNA_MODE")
SECURE = MODE == "production"
parsed = urlsplit(ORIGIN)
if (parsed.scheme not in {"http", "https"} or not parsed.hostname
        or parsed.path or parsed.query or parsed.fragment or parsed.username):
    raise RuntimeError("LUNA_ORIGIN must be an origin without a trailing slash")
if SECURE and (parsed.scheme != "https" or len(RATE_SECRET) < 32 or not DSN):
    raise RuntimeError("Production requires HTTPS, a database URL and a strong rate-limit secret")
COOKIE = "__Host-luna" if SECURE else "luna_dev"
SESSION_SECONDS = 8 * 60 * 60

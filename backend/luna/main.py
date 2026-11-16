from collections.abc import Iterator
from datetime import date, datetime, timezone
from hashlib import sha256
from pathlib import Path
import hmac
import secrets
from typing import Annotated
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from psycopg import Connection, errors
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import COOKIE, ORIGIN, RATE_SECRET, SECURE, SESSION_SECONDS
from .db import connect
from .prediction import summarize
from .schemas import Checkin, Credentials, PasswordConfirmation, Period, Profile, Registration

app = FastAPI(title="LUNA AI", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=[urlsplit(ORIGIN).hostname])
hasher = PasswordHasher()
dummy_hash = hasher.hash(secrets.token_urlsafe(32))
PUBLIC_PROFILE = "id, email, name, timezone"
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def headers_and_origin(request: Request, call_next):
    if request.method in WRITE_METHODS and request.headers.get("origin") != ORIGIN:
        response = JSONResponse({"detail": "Request origin rejected."}, status_code=403)
    else:
        response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; "
        "font-src 'self'; img-src 'self' data:; connect-src 'self'; "
        "base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    )
    return response


@app.exception_handler(RequestValidationError)
async def invalid_input(request: Request, exc: RequestValidationError):
    # Validation exceptions can contain the original values, including passwords.
    return JSONResponse({"detail": "Check the values you entered."}, status_code=422)


def database() -> Iterator[Connection]:
    with connect() as db:
        yield db


DB = Annotated[Connection, Depends(database)]


def token_digest(token: str) -> bytes:
    return sha256(token.encode()).digest()


def user_from_session(request: Request, db: DB) -> dict:
    token = request.cookies.get(COOKIE, "")
    if not token or len(token) != 43:
        raise HTTPException(401, "Please sign in.")
    user = db.execute(
        """SELECT u.id, u.email, u.name, u.timezone
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = %s AND s.expires_at > now()""",
        (token_digest(token),),
    ).fetchone()
    if user is None:
        raise HTTPException(401, "Please sign in.")
    return user


User = Annotated[dict, Depends(user_from_session)]


def account_today(user: dict) -> date:
    return datetime.now(ZoneInfo(user["timezone"])).date()


def verify_password(digest: str, password: str) -> bool:
    try:
        return hasher.verify(digest, password)
    except VerifyMismatchError:
        return False


def throttle(request: Request, email: str, action: str):
    # Do not persist raw login identifiers in the limiter.
    address = request.client.host if request.client else "unknown"
    with connect() as db:
        blocked = False
        for key, limit in ((f"ip:{address}", 60), (f"identity:{email}", 10)):
            bucket = hmac.digest(RATE_SECRET, f"{action}:{key}".encode(), "sha256")
            attempts = db.execute(
                """INSERT INTO auth_limits VALUES (%s, 1, now() + interval '15 minutes')
                   ON CONFLICT (bucket) DO UPDATE SET
                       attempts = CASE WHEN auth_limits.expires_at <= now() THEN 1
                                   ELSE LEAST(auth_limits.attempts + 1, 1000) END,
                       expires_at = CASE WHEN auth_limits.expires_at <= now()
                                    THEN excluded.expires_at ELSE auth_limits.expires_at END
                   RETURNING attempts""",
                (bucket,),
            ).fetchone()["attempts"]
            blocked |= attempts > limit
            if blocked:
                break
    if blocked:
        raise HTTPException(429, "Too many attempts. Try again later.")


def start_session(db: Connection, request: Request, response: Response, user_id: int):
    previous = request.cookies.get(COOKIE, "")
    if len(previous) == 43:
        db.execute("DELETE FROM sessions WHERE token_hash = %s", (token_digest(previous),))
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions VALUES (%s, %s, now() + make_interval(secs => %s))",
               (token_digest(token), user_id, SESSION_SECONDS))
    db.commit()
    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, secure=SECURE,
                        httponly=True, samesite="strict", path="/")


def clear_cookie(response: Response):
    response.delete_cookie(COOKIE, path="/", secure=SECURE, httponly=True, samesite="strict")


@app.get("/api/health")
def health(db: DB):
    db.execute("SELECT 1 FROM schema_migrations LIMIT 1")
    return {"status": "ok"}


@app.post("/api/auth/register", status_code=201)
def register(data: Registration, request: Request, response: Response, db: DB):
    email = data.email.casefold()
    throttle(request, email, "register")
    digest = hasher.hash(data.password.get_secret_value())
    try:
        user = db.execute(
            f"INSERT INTO users (email, password_hash, name, timezone) VALUES (%s, %s, %s, %s) RETURNING {PUBLIC_PROFILE}",
            (email, digest, data.name, data.timezone),
        ).fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "Could not register with these details.") from None
    start_session(db, request, response, user["id"])
    return user


@app.post("/api/auth/login")
def login(data: Credentials, request: Request, response: Response, db: DB):
    email = data.email.casefold()
    throttle(request, email, "login")
    user = db.execute(f"SELECT {PUBLIC_PROFILE}, password_hash FROM users WHERE email = %s",
                      (email,)).fetchone()
    digest = user.pop("password_hash") if user else dummy_hash
    password = data.password.get_secret_value()
    if not verify_password(digest, password) or user is None:
        raise HTTPException(401, "Email or password is incorrect.")
    if hasher.check_needs_rehash(digest):
        db.execute("UPDATE users SET password_hash = %s WHERE id = %s AND password_hash = %s",
                   (hasher.hash(password), user["id"], digest))
    start_session(db, request, response, user["id"])
    return user


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request, response: Response, db: DB):
    token = request.cookies.get(COOKIE, "")
    if len(token) == 43:
        db.execute("DELETE FROM sessions WHERE token_hash = %s", (token_digest(token),))
        db.commit()
    clear_cookie(response)


@app.get("/api/me")
def profile(user: User):
    return user


@app.patch("/api/me")
def update_profile(data: Profile, user: User, db: DB):
    updated = db.execute(
        f"UPDATE users SET name = %s, timezone = %s WHERE id = %s RETURNING {PUBLIC_PROFILE}",
        (data.name, data.timezone, user["id"]),
    ).fetchone()
    db.commit()
    if updated is None:
        raise HTTPException(401, "Please sign in.")
    return updated


@app.delete("/api/me", status_code=204)
def delete_account(data: PasswordConfirmation, request: Request, response: Response, user: User, db: DB):
    throttle(request, user["email"], "delete")
    row = db.execute("SELECT password_hash FROM users WHERE id = %s FOR UPDATE", (user["id"],)).fetchone()
    if not row or not verify_password(row["password_hash"], data.password.get_secret_value()):
        raise HTTPException(403, "Password is incorrect.")
    db.execute("DELETE FROM users WHERE id = %s", (user["id"],))
    db.commit()
    clear_cookie(response)


def records(db: Connection, user_id: int) -> dict:
    # One statement gives the export and dashboard a consistent PostgreSQL snapshot.
    return db.execute(
        '''SELECT
            COALESCE((SELECT json_agg(p ORDER BY p.start) FROM
                (SELECT id, start_date AS start, end_date AS "end" FROM periods WHERE user_id = %s) p), '[]') AS periods,
            COALESCE((SELECT json_agg(c ORDER BY c.day) FROM
                (SELECT day, mood, symptoms FROM checkins WHERE user_id = %s) c), '[]') AS checkins''',
        (user_id, user_id),
    ).fetchone()


@app.get("/api/dashboard")
def dashboard(user: User, db: DB):
    data = records(db, user["id"])
    today = account_today(user)
    dated_periods = [
        {"start": date.fromisoformat(p["start"]), "end": date.fromisoformat(p["end"]) if p["end"] else None}
        for p in data["periods"]
    ]
    return {**data, "today": today, "summary": summarize(dated_periods, today)}


@app.get("/api/export")
def export(user: User, db: DB, response: Response):
    response.headers["Content-Disposition"] = 'attachment; filename="luna-data.json"'
    profile_data = {key: user[key] for key in ("name", "email", "timezone")}
    return {"version": 1, "exported_at": datetime.now(timezone.utc), "profile": profile_data,
            **records(db, user["id"])}


def lock_user(db: Connection, user: dict):
    if not db.execute("SELECT id FROM users WHERE id = %s FOR UPDATE", (user["id"],)).fetchone():
        raise HTTPException(401, "Please sign in.")


def save_period(db: Connection, user: dict, data: Period, period_id: int | None = None):
    today = account_today(user)
    if data.start > today or (data.end and not data.start <= data.end <= today):
        raise HTTPException(422, "Use past or current dates, with the end on or after the start.")
    # Serialize writes for the same owner so concurrent requests cannot create overlaps.
    lock_user(db, user)
    if period_id is not None and not db.execute(
        "SELECT 1 FROM periods WHERE id = %s AND user_id = %s", (period_id, user["id"]),
    ).fetchone():
        raise HTTPException(404, "Period entry not found.")
    overlap = db.execute(
        """SELECT 1 FROM periods WHERE user_id = %s AND id <> %s
           AND start_date <= COALESCE(%s::date, 'infinity'::date)
           AND COALESCE(end_date, 'infinity'::date) >= %s LIMIT 1""",
        (user["id"], period_id or 0, data.end, data.start),
    ).fetchone()
    if overlap:
        raise HTTPException(409, "These dates overlap another period. End an ongoing period first.")
    if period_id is None:
        row = db.execute("INSERT INTO periods (user_id, start_date, end_date) VALUES (%s, %s, %s) RETURNING id",
                         (user["id"], data.start, data.end)).fetchone()
        period_id = row["id"]
    else:
        db.execute("UPDATE periods SET start_date = %s, end_date = %s WHERE id = %s AND user_id = %s",
                   (data.start, data.end, period_id, user["id"]))
    db.commit()
    return {"id": period_id, "start": data.start, "end": data.end}


@app.post("/api/periods", status_code=201)
def add_period(data: Period, user: User, db: DB):
    return save_period(db, user, data)


@app.put("/api/periods/{period_id}")
def edit_period(period_id: int, data: Period, user: User, db: DB):
    return save_period(db, user, data, period_id)


@app.delete("/api/periods/{period_id}", status_code=204)
def remove_period(period_id: int, user: User, db: DB):
    lock_user(db, user)
    if not db.execute("DELETE FROM periods WHERE id = %s AND user_id = %s RETURNING id",
                      (period_id, user["id"])).fetchone():
        raise HTTPException(404, "Period entry not found.")
    db.commit()


@app.put("/api/checkins/{day}")
def save_checkin(day: date, data: Checkin, user: User, db: DB):
    if day > account_today(user):
        raise HTTPException(422, "Choose today or a previous date.")
    lock_user(db, user)
    symptoms = list(dict.fromkeys(data.symptoms))
    db.execute(
        """INSERT INTO checkins VALUES (%s, %s, %s, %s)
           ON CONFLICT (user_id, day) DO UPDATE SET mood = excluded.mood, symptoms = excluded.symptoms""",
        (user["id"], day, data.mood, symptoms),
    )
    db.commit()
    return {"day": day, "mood": data.mood, "symptoms": symptoms}


@app.delete("/api/checkins/{day}", status_code=204)
def remove_checkin(day: date, user: User, db: DB):
    db.execute("DELETE FROM checkins WHERE user_id = %s AND day = %s", (user["id"], day))
    db.commit()


# Serve the built React app under the same origin as the API so session cookies work.
_dist = Path(__file__).resolve().parents[2] / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")

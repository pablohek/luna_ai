from concurrent.futures import ThreadPoolExecutor
from datetime import date
import os
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from luna import config
from luna.db import connect, migrate
from luna.main import app

TEST_DATABASE = os.environ.get("LUNA_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE, reason="Set LUNA_TEST_DATABASE_URL to a disposable PostgreSQL database")
PASSWORD = "a-debug-only-password!"
ORIGIN = {"Origin": config.ORIGIN}


@pytest.fixture(scope="module", autouse=True)
def test_database():
    if TEST_DATABASE != config.DSN:
        pytest.fail("Set LUNA_DATABASE_URL and LUNA_TEST_DATABASE_URL to the same disposable database")
    migrate()


@pytest.fixture
def client_factory():
    emails = []

    def create():
        client = TestClient(app, base_url=config.ORIGIN, headers=ORIGIN)
        email = f"luna-{uuid4().hex}@example.com"
        emails.append(email)
        response = client.post("/api/auth/register", json={
            "name": "Test User", "email": email, "password": PASSWORD, "timezone": "UTC",
        })
        assert response.status_code == 201, response.text
        assert "httponly" in response.headers["set-cookie"].lower()
        assert "samesite=strict" in response.headers["set-cookie"].lower()
        assert ("secure" in response.headers["set-cookie"].lower()) == config.SECURE
        return client, email, response.json()["id"]

    yield create
    with connect() as db:
        db.execute("DELETE FROM users WHERE email = ANY(%s)", (emails,))


def test_signup_logout_login_and_expiry(client_factory):
    client, email, user_id = client_factory()
    profile = client.get("/api/me")
    assert profile.json()["name"] == "Test User"
    assert profile.headers["cache-control"] == "no-store"
    with connect() as db:
        row = db.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,)).fetchone()
        assert row["password_hash"].startswith("$argon2id$")
    token = client.cookies.get(config.COOKIE)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/me", headers={"Cookie": f"{config.COOKIE}={token}"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": "wrong"}).status_code == 401
    login = client.post("/api/auth/login", json={"email": email.upper(), "password": PASSWORD})
    assert login.status_code == 200
    assert client.cookies.get(config.COOKIE) != token
    with connect() as db:
        db.execute("UPDATE sessions SET expires_at = now() WHERE user_id = %s", (user_id,))
    assert client.get("/api/me").status_code == 401


def test_origin_and_validation(client_factory):
    client, _, _ = client_factory()
    values = {"start": "2025-01-03", "end": "2025-01-05"}
    assert client.post("/api/periods", json=values, headers={"Origin": "https://other.example"}).status_code == 403
    assert TestClient(app, base_url=config.ORIGIN).post("/api/auth/logout").status_code == 403
    response = client.post("/api/auth/login", json={"email": "not-email", "password": "secret-marker"})
    assert response.status_code == 422
    assert "secret-marker" not in response.text
    assert client.post("/api/periods", json={"start": "2999-01-01"}).status_code == 422
    assert client.post("/api/periods", json={"start": values["end"], "end": values["start"]}).status_code == 422


def test_account_isolation_and_export_and_delete(client_factory):
    owner, _, owner_id = client_factory()
    other, _, _ = client_factory()
    period = {"start": "2025-01-03", "end": "2025-01-05"}
    response = owner.post("/api/periods", json=period)
    assert response.status_code == 201, response.text
    period_id = response.json()["id"]
    assert other.put(f"/api/periods/{period_id}", json=period).status_code == 404
    assert other.delete(f"/api/periods/{period_id}").status_code == 404
    assert owner.put("/api/checkins/2025-01-04", json={"mood": "Tired", "symptoms": ["Cramps", "Cramps"]}).status_code == 200
    assert other.get("/api/dashboard").json()["periods"] == []
    export = owner.get("/api/export")
    assert export.json()["checkins"] == [{"day": "2025-01-04", "mood": "Tired", "symptoms": ["Cramps"]}]
    assert export.json()["periods"][0]["id"] == period_id
    assert "password" not in export.text
    assert "attachment" in export.headers["content-disposition"]
    assert owner.request("DELETE", "/api/me", json={"password": "wrong"}).status_code == 403
    assert owner.request("DELETE", "/api/me", json={"password": PASSWORD}).status_code == 204
    assert owner.get("/api/me").status_code == 401
    with connect() as db:
        for table in ["periods", "checkins", "sessions"]:
            assert db.execute(f"SELECT 1 FROM {table} WHERE user_id = %s", (owner_id,)).fetchone() is None
    assert other.get("/api/me").status_code == 200


def test_concurrent_overlapping_writes(client_factory):
    client, _, _ = client_factory()
    period = {"start": "2025-03-01", "end": "2025-03-05"}
    with ThreadPoolExecutor(max_workers=2) as pool:
        status = list(pool.map(lambda _: client.post("/api/periods", json=period).status_code, range(2)))
    assert sorted(status) == [201, 409]
    assert len(client.get("/api/dashboard").json()["periods"]) == 1


def test_open_period_edit_settings_and_calendar_data(client_factory):
    client, _, _ = client_factory()
    response = client.post("/api/periods", json={"start": "2025-01-01"})
    assert response.status_code == 201
    period_id = response.json()["id"]
    assert client.post("/api/periods", json={"start": "2025-01-28"}).status_code == 409
    assert client.put(f"/api/periods/{period_id}", json={"start": "2025-01-01", "end": "2025-01-04"}).status_code == 200
    assert client.patch("/api/me", json={"name": "A New Name", "timezone": "Asia/Kuala_Lumpur"}).json()["name"] == "A New Name"
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["periods"][0]["end"] == "2025-01-04"
    assert date.fromisoformat(dashboard["today"]).year >= 2025
    assert client.delete(f"/api/periods/{period_id}").status_code == 204


def test_login_attempts_are_rate_limited(client_factory):
    client, email, _ = client_factory()
    for _ in range(10):
        assert client.post("/api/auth/login", json={"email": email, "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).status_code == 429

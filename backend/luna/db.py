from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from .config import DSN


def connect():
    if not DSN:
        raise RuntimeError("Set LUNA_DATABASE_URL before starting LUNA")
    return psycopg.connect(DSN, row_factory=dict_row, connect_timeout=5)


def migrate():
    directory = Path(__file__).resolve().parents[1] / "migrations"
    with connect() as db:
        db.execute("SELECT pg_advisory_xact_lock(901967113)")
        db.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)")
        for path in sorted(directory.glob("*.sql")):
            if not db.execute("SELECT 1 FROM schema_migrations WHERE name = %s",
                              (path.name,)).fetchone():
                db.execute(path.read_text(encoding="utf-8"))
                db.execute("INSERT INTO schema_migrations VALUES (%s)", (path.name,))
                print(f"Applied {path.name}")


if __name__ == "__main__":
    migrate()

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "monitor.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics (ts);

CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requested_at REAL NOT NULL,
    completed_at REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    filename TEXT,
    size_bytes INTEGER,
    error TEXT,
    extra_paths TEXT NOT NULL DEFAULT '[]'
);
"""


@contextmanager
def get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(backups)")}
        if "extra_paths" not in columns:
            conn.execute("ALTER TABLE backups ADD COLUMN extra_paths TEXT NOT NULL DEFAULT '[]'")


def insert_metric(payload: dict):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO metrics (ts, payload) VALUES (?, ?)",
            (time.time(), json.dumps(payload)),
        )


def latest_metric():
    with get_conn() as conn:
        row = conn.execute(
            "SELECT ts, payload FROM metrics ORDER BY ts DESC LIMIT 1"
        ).fetchone()
    if not row:
        return None
    return {"ts": row["ts"], **json.loads(row["payload"])}


def history_since(since_ts: float):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT ts, payload FROM metrics WHERE ts >= ? ORDER BY ts ASC",
            (since_ts,),
        ).fetchall()
    return [{"ts": r["ts"], **json.loads(r["payload"])} for r in rows]


def prune_older_than(cutoff_ts: float):
    with get_conn() as conn:
        conn.execute("DELETE FROM metrics WHERE ts < ?", (cutoff_ts,))


def create_backup_request(extra_paths: list[str] | None = None) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO backups (requested_at, status, extra_paths) VALUES (?, 'pending', ?)",
            (time.time(), json.dumps(extra_paths or [])),
        )
        return cur.lastrowid


def _parse_row(row) -> dict:
    d = dict(row)
    d["extra_paths"] = json.loads(d.get("extra_paths") or "[]")
    return d


def get_pending_backup():
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM backups WHERE status = 'pending' ORDER BY id ASC LIMIT 1"
        ).fetchone()
    return _parse_row(row) if row else None


def mark_backup_running(backup_id: int):
    with get_conn() as conn:
        conn.execute(
            "UPDATE backups SET status = 'running' WHERE id = ?", (backup_id,)
        )


def mark_backup_done(backup_id: int, filename: str, size_bytes: int):
    with get_conn() as conn:
        conn.execute(
            "UPDATE backups SET status = 'done', filename = ?, size_bytes = ?, "
            "completed_at = ? WHERE id = ?",
            (filename, size_bytes, time.time(), backup_id),
        )


def mark_backup_failed(backup_id: int, error: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE backups SET status = 'failed', error = ?, completed_at = ? "
            "WHERE id = ?",
            (error, time.time(), backup_id),
        )


def list_backups(limit: int = 50):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM backups ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [_parse_row(r) for r in rows]


def get_backup(backup_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM backups WHERE id = ?", (backup_id,)
        ).fetchone()
    return _parse_row(row) if row else None

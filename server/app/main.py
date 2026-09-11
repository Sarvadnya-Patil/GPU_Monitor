import secrets
import time
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, File, Form, HTTPException, Response, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import db
from . import auth as auth_module
from .auth import require_agent_token, require_dashboard_auth
from .ws import manager

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
BACKUPS_DIR = Path(__file__).resolve().parent.parent / "data" / "backups"
HISTORY_RETENTION_SECONDS = 24 * 3600
OFFLINE_AFTER_SECONDS = 60

app = FastAPI(title="GPU Monitor")


@app.on_event("startup")
def _startup():
    db.init_db()
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)


# ---- Agent -> server: metrics ingestion -----------------------------------

@app.post("/api/ingest", dependencies=[Depends(require_agent_token)])
async def ingest(payload: dict):
    db.insert_metric(payload)
    db.prune_older_than(time.time() - HISTORY_RETENTION_SECONDS)
    await manager.broadcast({"type": "metrics", "ts": time.time(), **payload})
    return {"ok": True}


# ---- Dashboard -> server: login/session ------------------------------------

class LoginBody(BaseModel):
    username: str
    password: str


@app.get("/api/auth/status")
def auth_status(session: str | None = Cookie(default=None, alias=auth_module.SESSION_COOKIE)):
    enabled = auth_module.dashboard_auth_enabled()
    authenticated = (not enabled) or bool(session and auth_module.verify_session_token(session))
    return {"enabled": enabled, "authenticated": authenticated}


@app.post("/api/login")
def login(body: LoginBody, response: Response):
    if not auth_module.check_login(body.username, body.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    name, value, max_age = auth_module.new_session_cookie()
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=auth_module.COOKIE_SECURE,
    )
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(auth_module.SESSION_COOKIE)
    return {"ok": True}


# ---- Agent pairing ----------------------------------------------------------
# Lets you set up a new agent without copying the long AGENT_TOKEN by hand:
# the dashboard shows a short code good for 5 minutes; the agent exchanges
# it, once, for the real token.

PAIRING_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # no 0/O/1/I/L


class PairBody(BaseModel):
    code: str


@app.post("/api/agent/pairing-code", dependencies=[Depends(require_dashboard_auth)])
def create_pairing_code():
    code = "".join(secrets.choice(PAIRING_CODE_ALPHABET) for _ in range(8))
    expires_at = db.create_pairing_code(code)
    return {"code": code, "expires_at": expires_at}


@app.post("/api/agent/pair")
def pair_agent(body: PairBody):
    code = body.code.strip().upper()
    if not db.consume_pairing_code(code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")
    return {"agent_token": auth_module.AGENT_TOKEN}


# ---- Dashboard -> server: read metrics -------------------------------------

@app.get("/api/metrics/latest", dependencies=[Depends(require_dashboard_auth)])
def metrics_latest():
    m = db.latest_metric()
    if not m:
        return {"online": False, "metric": None}
    online = (time.time() - m["ts"]) < OFFLINE_AFTER_SECONDS
    return {"online": online, "seconds_since_last_seen": time.time() - m["ts"], "metric": m}


@app.get("/api/metrics/history", dependencies=[Depends(require_dashboard_auth)])
def metrics_history(minutes: int = 60):
    since = time.time() - minutes * 60
    return {"points": db.history_since(since)}


# ---- Backups ----------------------------------------------------------------

class BackupRequestBody(BaseModel):
    extra_paths: list[str] = []


@app.post("/api/backup/request", dependencies=[Depends(require_dashboard_auth)])
def backup_request(body: BackupRequestBody = BackupRequestBody()):
    backup_id = db.create_backup_request(body.extra_paths)
    return {"id": backup_id, "status": "pending"}


@app.get("/api/backup/pending", dependencies=[Depends(require_agent_token)])
def backup_pending():
    pending = db.get_pending_backup()
    return {"pending": pending}


@app.post("/api/backup/{backup_id}/start", dependencies=[Depends(require_agent_token)])
def backup_start(backup_id: int):
    db.mark_backup_running(backup_id)
    return {"ok": True}


@app.post("/api/backup/{backup_id}/upload", dependencies=[Depends(require_agent_token)])
async def backup_upload(backup_id: int, file: UploadFile = File(...)):
    if not db.get_backup(backup_id):
        raise HTTPException(404, "Unknown backup id")
    filename = f"{backup_id}_{int(time.time())}_{file.filename}"
    dest = BACKUPS_DIR / filename
    size = 0
    with open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
            size += len(chunk)
    db.mark_backup_done(backup_id, filename, size)
    return {"ok": True, "size_bytes": size}


@app.post("/api/backup/{backup_id}/fail", dependencies=[Depends(require_agent_token)])
def backup_fail(backup_id: int, error: str = Form(...)):
    db.mark_backup_failed(backup_id, error)
    return {"ok": True}


@app.get("/api/backups", dependencies=[Depends(require_dashboard_auth)])
def backups_list():
    return {"backups": db.list_backups()}


@app.get("/api/backups/{backup_id}/download", dependencies=[Depends(require_dashboard_auth)])
def backup_download(backup_id: int):
    b = db.get_backup(backup_id)
    if not b or b["status"] != "done" or not b["filename"]:
        raise HTTPException(404, "Backup not available")
    path = BACKUPS_DIR / b["filename"]
    if not path.exists():
        raise HTTPException(404, "Backup file missing on disk")
    return FileResponse(path, filename=b["filename"], media_type="application/gzip")


# ---- Speed test ---------------------------------------------------------------
# Manually triggered from the dashboard, same request/poll pattern as backups:
# real bandwidth use, so it never runs on a timer.

@app.post("/api/speedtest/request", dependencies=[Depends(require_dashboard_auth)])
def speedtest_request():
    speedtest_id = db.create_speedtest_request()
    return {"id": speedtest_id, "status": "pending"}


@app.get("/api/speedtest/pending", dependencies=[Depends(require_agent_token)])
def speedtest_pending():
    return {"pending": db.get_pending_speedtest()}


@app.post("/api/speedtest/{speedtest_id}/start", dependencies=[Depends(require_agent_token)])
def speedtest_start(speedtest_id: int):
    db.mark_speedtest_running(speedtest_id)
    return {"ok": True}


class SpeedtestResultBody(BaseModel):
    download_mbps: float
    upload_mbps: float
    ping_ms: float
    server_name: str = ""


@app.post("/api/speedtest/{speedtest_id}/result", dependencies=[Depends(require_agent_token)])
def speedtest_result(speedtest_id: int, body: SpeedtestResultBody):
    db.mark_speedtest_done(
        speedtest_id, body.download_mbps, body.upload_mbps, body.ping_ms, body.server_name
    )
    return {"ok": True}


@app.post("/api/speedtest/{speedtest_id}/fail", dependencies=[Depends(require_agent_token)])
def speedtest_fail(speedtest_id: int, error: str = Form(...)):
    db.mark_speedtest_failed(speedtest_id, error)
    return {"ok": True}


@app.get("/api/speedtests", dependencies=[Depends(require_dashboard_auth)])
def speedtests_list():
    return {"speedtests": db.list_speedtests()}


# ---- Live updates -------------------------------------------------------------

@app.websocket("/ws/metrics")
async def ws_metrics(ws: WebSocket):
    if auth_module.dashboard_auth_enabled():
        session = ws.cookies.get(auth_module.SESSION_COOKIE)
        if not session or not auth_module.verify_session_token(session):
            await ws.close(code=4401)
            return
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)


# ---- Static dashboard ----------------------------------------------------------
# The HTML/JS shell itself carries no data, so it's served unauthenticated;
# the login page it renders is what gates the actual API calls above.

@app.get("/")
def dashboard_index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

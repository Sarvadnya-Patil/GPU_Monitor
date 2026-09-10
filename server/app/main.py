import time
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import db
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


# ---- Live updates -------------------------------------------------------------

@app.websocket("/ws/metrics")
async def ws_metrics(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)


# ---- Static dashboard ----------------------------------------------------------

@app.get("/", dependencies=[Depends(require_dashboard_auth)])
def dashboard_index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

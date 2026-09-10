#!/usr/bin/env python3
"""Outbound-only agent: polls local GPU/host stats and pushes them to the
dashboard server over HTTPS. Also polls for pending backup requests and,
when one appears, tars up the pip cache + portable git install (+ a
`pip freeze` lockfile) and uploads it.

Runs on the GPU workstation. Never accepts inbound connections — everything
here is an outbound HTTP call, which is what makes this work despite the
workstation not being reachable from outside the jump host.
"""
import io
import os
import subprocess
import sys
import tarfile
import time
import traceback
from pathlib import Path

import psutil
import requests
from dotenv import load_dotenv

load_dotenv()

SERVER_URL = os.environ["SERVER_URL"].rstrip("/")
AGENT_TOKEN = os.environ["AGENT_TOKEN"]
PUSH_INTERVAL = float(os.environ.get("PUSH_INTERVAL_SECONDS", "15"))
BACKUP_POLL_EVERY = int(os.environ.get("BACKUP_POLL_EVERY_TICKS", "4"))

VENV_PYTHON = os.environ.get("VENV_PYTHON", sys.executable)
PIP_CACHE_DIR = Path(os.environ.get("PIP_CACHE_DIR", "~/.cache/pip")).expanduser()
GIT_INSTALL_DIR = Path(os.environ.get("GIT_INSTALL_DIR", "~/local/git")).expanduser()

HEADERS = {"Authorization": f"Bearer {AGENT_TOKEN}"}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)


# --------------------------------------------------------------------------
# Metrics collection
# --------------------------------------------------------------------------

def collect_gpus():
    query = "index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw"
    out = subprocess.run(
        ["nvidia-smi", f"--query-gpu={query}", "--format=csv,noheader,nounits"],
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    ).stdout.strip()

    gpus = []
    for line in out.splitlines():
        idx, name, util, mem_used, mem_total, temp, power = [
            p.strip() for p in line.split(",")
        ]
        gpus.append(
            {
                "index": int(idx),
                "name": name,
                "util_percent": float(util),
                "mem_used_mb": float(mem_used),
                "mem_total_mb": float(mem_total),
                "temp_c": float(temp),
                "power_w": float(power) if power not in ("", "[N/A]") else 0.0,
            }
        )
    return gpus


def collect_processes():
    query = "pid,process_name,gpu_uuid,used_memory"
    out = subprocess.run(
        ["nvidia-smi", f"--query-compute-apps={query}", "--format=csv,noheader,nounits"],
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    ).stdout.strip()

    uuid_out = subprocess.run(
        ["nvidia-smi", "--query-gpu=index,uuid", "--format=csv,noheader"],
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    ).stdout.strip()
    uuid_to_index = {}
    for line in uuid_out.splitlines():
        idx, uuid = [p.strip() for p in line.split(",")]
        uuid_to_index[uuid] = int(idx)

    processes = []
    if not out:
        return processes
    for line in out.splitlines():
        pid, name, gpu_uuid, mem_mb = [p.strip() for p in line.split(",")]
        processes.append(
            {
                "pid": int(pid),
                "name": name,
                "gpu_index": uuid_to_index.get(gpu_uuid, -1),
                "mem_mb": float(mem_mb) if mem_mb not in ("", "[N/A]") else 0.0,
            }
        )
    return processes


def collect_host():
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage(str(Path.home()))
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "ram_used_gb": ram.used / 1e9,
        "ram_total_gb": ram.total / 1e9,
        "disk_used_gb": disk.used / 1e9,
        "disk_total_gb": disk.total / 1e9,
    }


def collect_payload():
    return {
        "gpus": collect_gpus(),
        "processes": collect_processes(),
        "host": collect_host(),
    }


# --------------------------------------------------------------------------
# Backup
# --------------------------------------------------------------------------

def run_pip_freeze() -> bytes:
    out = subprocess.run(
        [VENV_PYTHON, "-m", "pip", "freeze"],
        capture_output=True,
        text=True,
        timeout=60,
        check=True,
    ).stdout
    return out.encode("utf-8")


def build_backup_tarball(request_extra_paths: list[str] | None = None) -> io.BytesIO:
    # Extra paths come from the specific backup request made on the dashboard.
    extra_paths = [Path(p).expanduser() for p in (request_extra_paths or [])]

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        if PIP_CACHE_DIR.exists():
            tar.add(PIP_CACHE_DIR, arcname="cache_pip")
        if GIT_INSTALL_DIR.exists():
            tar.add(GIT_INSTALL_DIR, arcname="local_git")

        for i, path in enumerate(extra_paths):
            if path.exists():
                tar.add(path, arcname=f"extra_{i}_{path.name}")
            else:
                print(f"[backup] extra path does not exist, skipping: {path}")

        lockfile = run_pip_freeze()
        info = tarfile.TarInfo(name="pip-freeze.lock.txt")
        info.size = len(lockfile)
        info.mtime = int(time.time())
        tar.addfile(info, io.BytesIO(lockfile))

    buf.seek(0)
    return buf


def handle_pending_backup():
    resp = SESSION.get(f"{SERVER_URL}/api/backup/pending", timeout=15)
    resp.raise_for_status()
    pending = resp.json().get("pending")
    if not pending:
        return

    backup_id = pending["id"]
    print(f"[backup] starting backup #{backup_id}")
    SESSION.post(f"{SERVER_URL}/api/backup/{backup_id}/start", timeout=15)

    try:
        tarball = build_backup_tarball(pending.get("extra_paths"))
        files = {"file": (f"backup_{backup_id}.tar.gz", tarball, "application/gzip")}
        r = SESSION.post(
            f"{SERVER_URL}/api/backup/{backup_id}/upload", files=files, timeout=600
        )
        r.raise_for_status()
        print(f"[backup] #{backup_id} uploaded")
    except Exception as exc:  # noqa: BLE001
        error = f"{exc}\n{traceback.format_exc()}"
        print(f"[backup] #{backup_id} failed: {exc}")
        try:
            SESSION.post(
                f"{SERVER_URL}/api/backup/{backup_id}/fail",
                data={"error": error[:2000]},
                timeout=15,
            )
        except Exception:  # noqa: BLE001
            pass


# --------------------------------------------------------------------------
# Main loop
# --------------------------------------------------------------------------

def push_metrics_with_retry(payload: dict, retries: int = 3):
    delay = 2
    for attempt in range(1, retries + 1):
        try:
            r = SESSION.post(f"{SERVER_URL}/api/ingest", json=payload, timeout=15)
            r.raise_for_status()
            return
        except requests.RequestException as exc:
            print(f"[push] attempt {attempt}/{retries} failed: {exc}")
            if attempt < retries:
                time.sleep(delay)
                delay *= 2


def main():
    print(f"[agent] pushing to {SERVER_URL} every {PUSH_INTERVAL}s")
    tick = 0
    while True:
        start = time.time()
        try:
            payload = collect_payload()
            push_metrics_with_retry(payload)
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] metrics collection failed: {exc}")

        tick += 1
        if tick % BACKUP_POLL_EVERY == 0:
            try:
                handle_pending_backup()
            except Exception as exc:  # noqa: BLE001
                print(f"[agent] backup poll failed: {exc}")

        elapsed = time.time() - start
        time.sleep(max(0.0, PUSH_INTERVAL - elapsed))


if __name__ == "__main__":
    main()

# GPU Monitor

A small dashboard for watching the remote GPU workstation, without hosting
anything on the workstation itself.

## Why it's shaped this way

The GPU workstation sits behind a jump host on the college network and is
**not reachable from outside** — see [GPU_SETUP_CONTEXT.md](./GPU_SETUP_CONTEXT.md)
for the topology. So instead of the dashboard reaching *in* to the GPU box,
it's the other way around:

- **`server/`** — a FastAPI app + React dashboard, deployed on your home
  server (behind your Cloudflare Tunnel + domain). It stores recent metrics
  and serves the UI.
- **`agent/`** — a small Python script that runs *on* the GPU workstation.
  It only ever makes outbound HTTPS calls: it pushes metrics on a timer and
  polls for backup requests. No inbound port is ever opened on the GPU box.

```
GPU workstation (agent, outbound only) --HTTPS--> home server (FastAPI) <--Cloudflare Tunnel-- you, anywhere
```

## What it shows

- Per-GPU utilization, memory, temperature, power (from `nvidia-smi`)
- Processes currently using the GPU
- Host CPU / RAM / disk usage
- Online/offline status, derived from how long ago the agent last pushed
- A "Backup now" button that has the agent tar up `~/.cache/pip`,
  `~/local/git`, and a fresh `pip freeze` lockfile, then upload it — useful
  for restoring the environment if the workstation is ever wiped

## Server setup (home server)

```bash
cd server
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cp .env.example .env
# edit .env: set AGENT_TOKEN to a long random secret.
# DASHBOARD_USER/PASS are optional — leave blank if Cloudflare Access
# (or similar) already gates the tunnel.
```

Build the frontend (from `frontend/`, outputs straight into `server/static/`):

```bash
cd frontend
npm install
npm run build
```

Run it:

```bash
cd server
venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

For a persistent deployment, use the provided systemd unit
(`server/gpu-monitor-server.service`) — edit the paths/user in it, then:

```bash
sudo cp gpu-monitor-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gpu-monitor-server
```

Point your Cloudflare Tunnel's ingress at `http://127.0.0.1:8000` for
whatever hostname you want (e.g. `gpu.yourdomain.com`).

## Agent setup (GPU workstation)

```bash
cd agent
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:
- `SERVER_URL` — your public dashboard URL (e.g. `https://gpu.yourdomain.com`)
- `AGENT_TOKEN` — must match the server's `AGENT_TOKEN`
- `VENV_PYTHON` — path to the Python whose `pip freeze` you want in backups
  (e.g. `~/venvs/oceanembed/bin/python`)
- `PIP_CACHE_DIR` / `GIT_INSTALL_DIR` — default to `~/.cache/pip` and
  `~/local/git`, matching what's documented in `GPU_SETUP_CONTEXT.md`

Run manually to check it works:

```bash
venv/bin/python gpu_agent.py
```

For a persistent deployment, use `agent/gpu-monitor-agent.service` — edit
the paths/user, then install it the same way as the server's unit. `Restart=always`
means it reconnects on its own after the workstation's known flaky network
drops.

## Local development

```bash
# terminal 1 — API with hot reload
cd server && venv/bin/uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend with hot reload, proxied to the API above
cd frontend && npm run dev
```

`vite.config.ts` proxies `/api` and `/ws` to `localhost:8000` in dev.

## Security notes

- `AGENT_TOKEN` is the only thing standing between the internet and your
  ingest/backup endpoints — keep `.env` out of git (already gitignored) and
  make it long and random.
- If the dashboard itself needs to stay private, either set
  `DASHBOARD_USER`/`DASHBOARD_PASS` for HTTP Basic Auth, or put it behind
  Cloudflare Access on the tunnel (preferred, since it doesn't rely on
  Basic Auth going out in the clear if the tunnel is ever misconfigured).

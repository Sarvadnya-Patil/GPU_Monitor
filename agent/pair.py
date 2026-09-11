#!/usr/bin/env python3
"""One-time setup helper: exchanges a 5-minute pairing code (generated on
the dashboard) for the real AGENT_TOKEN, and writes/updates .env with it —
so you don't have to copy the long token by hand.

Usage:
    python pair.py <server-url> <code>
    python pair.py https://gpu.yourdomain.com AB3KQ9ZR
"""
import sys
from pathlib import Path

import requests

ENV_PATH = Path(__file__).resolve().parent / ".env"
ENV_EXAMPLE_PATH = Path(__file__).resolve().parent / ".env.example"


def write_env(server_url: str, agent_token: str):
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text().splitlines()
    elif ENV_EXAMPLE_PATH.exists():
        lines = ENV_EXAMPLE_PATH.read_text().splitlines()
    else:
        lines = []

    def upsert(lines: list[str], key: str, value: str) -> list[str]:
        prefix = f"{key}="
        for i, line in enumerate(lines):
            if line.startswith(prefix):
                lines[i] = f"{key}={value}"
                return lines
        lines.append(f"{key}={value}")
        return lines

    lines = upsert(lines, "SERVER_URL", server_url)
    lines = upsert(lines, "AGENT_TOKEN", agent_token)
    ENV_PATH.write_text("\n".join(lines) + "\n")


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    server_url = sys.argv[1].rstrip("/")
    code = sys.argv[2]

    resp = requests.post(f"{server_url}/api/agent/pair", json={"code": code}, timeout=15)
    if resp.status_code != 200:
        print(f"Pairing failed: {resp.status_code} {resp.text}")
        sys.exit(1)

    agent_token = resp.json()["agent_token"]
    write_env(server_url, agent_token)
    print(f"Paired. Wrote SERVER_URL and AGENT_TOKEN to {ENV_PATH}")


if __name__ == "__main__":
    main()

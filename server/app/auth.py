import hashlib
import hmac
import os
import secrets
import time

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPBearer

AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")
DASHBOARD_USER = os.environ.get("DASHBOARD_USER", "")
DASHBOARD_PASS = os.environ.get("DASHBOARD_PASS", "")

# Signs session cookies. Falls back to AGENT_TOKEN so a dedicated secret
# isn't a hard requirement, but you can set SESSION_SECRET separately.
SESSION_SECRET = os.environ.get("SESSION_SECRET", "") or AGENT_TOKEN
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() != "false"

SESSION_COOKIE = "gpu_monitor_session"
SESSION_TTL_SECONDS = 7 * 24 * 3600

_bearer = HTTPBearer(auto_error=False)


def require_agent_token(creds=Depends(_bearer)):
    if not AGENT_TOKEN:
        raise HTTPException(500, "AGENT_TOKEN is not configured on the server")
    if creds is None or not secrets.compare_digest(creds.credentials, AGENT_TOKEN):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid agent token")
    return True


def dashboard_auth_enabled() -> bool:
    return bool(DASHBOARD_USER and DASHBOARD_PASS)


def check_login(username: str, password: str) -> bool:
    return secrets.compare_digest(username, DASHBOARD_USER) and secrets.compare_digest(
        password, DASHBOARD_PASS
    )


def _sign(expiry: int) -> str:
    mac = hmac.new(SESSION_SECRET.encode(), str(expiry).encode(), hashlib.sha256).hexdigest()
    return f"{expiry}.{mac}"


def verify_session_token(token: str) -> bool:
    try:
        expiry_str, mac = token.split(".", 1)
        expiry = int(expiry_str)
    except ValueError:
        return False
    if time.time() > expiry:
        return False
    expected = hmac.new(SESSION_SECRET.encode(), expiry_str.encode(), hashlib.sha256).hexdigest()
    return secrets.compare_digest(mac, expected)


def new_session_cookie() -> tuple[str, str, int]:
    """Returns (cookie_name, value, max_age) for a freshly issued session."""
    expiry = int(time.time()) + SESSION_TTL_SECONDS
    return SESSION_COOKIE, _sign(expiry), SESSION_TTL_SECONDS


def require_dashboard_auth(session: str | None = Cookie(default=None, alias=SESSION_COOKIE)):
    if not dashboard_auth_enabled():
        # No credentials configured: dashboard is intentionally open.
        return True
    if not session or not verify_session_token(session):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return True

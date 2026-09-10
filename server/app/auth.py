import os
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials, HTTPBearer

AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")
DASHBOARD_USER = os.environ.get("DASHBOARD_USER", "")
DASHBOARD_PASS = os.environ.get("DASHBOARD_PASS", "")

_bearer = HTTPBearer(auto_error=False)
_basic = HTTPBasic(auto_error=False)


def require_agent_token(creds=Depends(_bearer)):
    if not AGENT_TOKEN:
        raise HTTPException(500, "AGENT_TOKEN is not configured on the server")
    if creds is None or not secrets.compare_digest(creds.credentials, AGENT_TOKEN):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid agent token")
    return True


def require_dashboard_auth(creds: HTTPBasicCredentials = Depends(_basic)):
    if not DASHBOARD_USER or not DASHBOARD_PASS:
        # No credentials configured: dashboard is intentionally open.
        return True
    valid_user = creds is not None and secrets.compare_digest(
        creds.username, DASHBOARD_USER
    )
    valid_pass = creds is not None and secrets.compare_digest(
        creds.password, DASHBOARD_PASS
    )
    if not (valid_user and valid_pass):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid dashboard credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return True

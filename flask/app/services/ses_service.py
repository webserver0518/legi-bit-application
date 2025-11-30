# app/services/s3_service.py
import requests
from flask import current_app

from ..managers.response_management import ResponseManager
from .http_client import safe_service_request


# ------------------------ Core ------------------------
def get_ses_url():
    return current_app.config["SES_SERVICE_URL"]


def _ping_service():
    """Check if the SES service is reachable."""
    resp = requests.get(f"{get_ses_url()}/healthz", timeout=3)
    if resp.status_code == 200:
        return ResponseManager.success(message="SES service reachable")
    else:
        return ResponseManager.error(
            error=f"SES service unhealthy (status {resp.status_code})"
        )


def _safe_request(method: str, path: str, **kwargs) -> tuple:
    """Safely perform an HTTP request to the SES service."""
    return safe_service_request(
        service_url=get_ses_url(), method=method, path=path, **kwargs
    )


# ------------------------ Send Email -------------------------


def send_email(to_email: str, subject: str, message: str):
    return _safe_request(
        "POST",
        "/send_email",
        json={"to": to_email, "subject": subject, "message": message},
    )

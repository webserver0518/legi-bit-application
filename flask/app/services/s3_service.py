# app/services/s3_service.py
import requests
from flask import current_app

from ..managers.response_management import ResponseManager


# ------------------------ Core ------------------------
def get_s3_url():
    return current_app.config["S3_SERVICE_URL"]

def _ping_service():
    """Check if the S3 service is reachable."""
    resp = requests.get(f"{get_s3_url()}/healthz", timeout=3)
    if resp.status_code == 200:
        return ResponseManager.success(message="S3 service reachable")
    else:
        return ResponseManager.error(error=f"S3 service unhealthy (status {resp.status_code})")
    
def _safe_request(method: str, path: str, **kwargs) -> tuple:
    """Safely perform an HTTP request to the S3 service."""
    url = f"{get_s3_url()}{path}"
    resp = requests.request(method, url, timeout=8, **kwargs)
    status = resp.status_code
    
    # Try to parse response JSON
    payload = resp.json()

    if not isinstance(payload, dict) or "success" not in payload:
        raise ValueError(f"Unexpected response format from {path}: {payload}")

    return ResponseManager._build(
        success=payload.get("success"),
        status=status,
        message=payload.get("message"),
        error=payload.get("error"),
        data=payload.get("data"),
    )

# ------------------------ Generate Presigned POST -------------------------
def generate_presigned_post(filename, filetype, filesize, key_override=None):
    return _safe_request("POST", "/presign/post", json={
        "filename": filename,
        "filetype": filetype,
        "filesize": filesize,
        "key_override": key_override
    })

# ------------------------ Generate Presigned GET -------------------------
def generate_presigned_get(key):
    return _safe_request("GET", "/presign/get", params={"key": key})


# ------------------------ Upload -------------------------
def create(fileobj, key):
    files = {"file": fileobj}
    data = {"key": key}
    return _safe_request("POST", "/create", files=files, data=data)


# ------------------------ Delete -------------------------
def delete(key):
    return _safe_request("DELETE", "/delete", json={"key": key})
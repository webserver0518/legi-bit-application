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


def _safe_request(method, path, **kwargs):
    try:
        resp = requests.request(method, f"{get_s3_url()}{path}", timeout=5, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"S3 service error: {e}")
        return {"success": False, "error": str(e)}

def generate_presigned_post(filename, filetype, filesize, key_override=None):
    return _safe_request("POST", "/presign/post", json={
        "filename": filename,
        "filetype": filetype,
        "filesize": filesize,
        "key_override": key_override
    })

def generate_presigned_get(key):
    return _safe_request("GET", "/presign/get", params={"key": key})

def delete(key):
    return _safe_request("DELETE", "/delete", json={"key": key})
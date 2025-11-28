# app/services/s3_service.py
import requests
from flask import current_app

from ..managers.response_management import ResponseManager
from .http_client import safe_service_request


# ------------------------ Core ------------------------
def get_s3_url():
    return current_app.config["S3_SERVICE_URL"]


def _ping_service():
    """Check if the S3 service is reachable."""
    resp = requests.get(f"{get_s3_url()}/healthz", timeout=3)
    if resp.status_code == 200:
        return ResponseManager.success(message="S3 service reachable")
    else:
        return ResponseManager.error(
            error=f"S3 service unhealthy (status {resp.status_code})"
        )


def _safe_request(method: str, path: str, **kwargs) -> tuple:
    """Safely perform an HTTP request to the S3 service."""
    return safe_service_request(
        service_url=get_s3_url(), method=method, path=path, **kwargs
    )


# ------------------------ List Keys -------------------------
def list_keys(prefix=""):
    return _safe_request("GET", "/list_keys", params={"prefix": prefix})


# ------------------------ Generate Presigned POST -------------------------
def generate_presigned_post(filename, filetype, filesize, key=None):
    return _safe_request(
        "POST",
        "/presign/post",
        json={
            "file_name": filename,
            "file_type": filetype,
            "file_size": filesize,
            "key": key,
        },
    )


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

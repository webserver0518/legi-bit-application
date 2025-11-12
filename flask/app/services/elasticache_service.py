# services/elasticache_service.py
import requests
from flask import current_app
from ..managers.response_management import ResponseManager


# ------------------------ Core ------------------------

def get_elasticache_url():
    """Return base URL of the ElastiCache microservice."""
    return current_app.config.get("ELASTICACHE_SERVICE_URL", "http://service-elasticache:8002")


def _ping_service():
    """Check if the ElastiCache service is reachable."""
    try:
        resp = requests.get(f"{get_elasticache_url()}/healthz", timeout=3)
        if resp.status_code == 200:
            return ResponseManager.success(message="ElastiCache service reachable")
        else:
            return ResponseManager.error(error=f"ElastiCache service unhealthy (status {resp.status_code})")
    except Exception as e:
        return ResponseManager.internal(error=f"Failed to reach ElastiCache service: {e}")


def _safe_request(method: str, path: str, **kwargs) -> tuple:
    """Safely perform an HTTP request to the ElastiCache service."""
    url = f"{get_elasticache_url()}{path}"
    try:
        resp = requests.request(method, url, timeout=8, **kwargs)
        status = resp.status_code
        payload = resp.json()
    except Exception as e:
        return ResponseManager.internal(error=f"HTTP error contacting ElastiCache: {e}")

    if not isinstance(payload, dict) or "success" not in payload:
        return ResponseManager.internal(error=f"Unexpected response format from {path}: {payload}")

    return ResponseManager._build(
        success=payload.get("success"),
        status=status,
        message=payload.get("message"),
        error=payload.get("error"),
        data=payload.get("data")
    )


# ------------------------ Basic Operations ------------------------

def get_value(key: str) -> tuple:
    """Retrieve a value from Redis cache via the ElastiCache microservice."""
    return _safe_request("GET", "/get_value", params={"key": key})


def set_value(key: str, value, ttl: int = 300) -> tuple:
    """Set a key-value pair in Redis with an optional TTL."""
    return _safe_request("POST", "/set_value", json={
        "key": key,
        "value": value,
        "ttl": ttl
    })


def delete_key(key: str) -> tuple:
    """Delete a specific key from Redis via ElastiCache service."""
    return _safe_request("DELETE", "/delete_key", params={"key": key})


def flush_all() -> tuple:
    """Flush all Redis keys. Use with caution!"""
    return _safe_request("POST", "/flush_all")


# ------------------------ Connectivity ------------------------

def ping() -> tuple:
    """Ping the ElastiCache service and underlying Redis connection."""
    return _safe_request("GET", "/ping")
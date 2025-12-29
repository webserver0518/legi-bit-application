# app/services/http_client.py
import json
import requests
from flask import current_app

from ..managers.response_management import ResponseManager


def safe_service_request(
    service_url: str, method: str, path: str, timeout: int = 30, **kwargs
):
    """
    Unified safe request handler for all microservice calls.
    Prevents 500 errors when services are down, slow, or return invalid data.
    """

    if not service_url:
        current_app.logger.error(f"❌ Missing service URL for call to {path}")
        msg = f"Service unavailable (invalid URL) - {path}"
        return ResponseManager.bad_gateway(message=msg)

    url = f"{service_url}{path}"

    try:
        # Network / connection / timeout protection
        resp = requests.request(method, url, timeout=timeout, **kwargs)
        status = resp.status_code

    except requests.RequestException as e:
        current_app.logger.error(f"❌ Network error calling {url}: {e}")
        msg = f"Service unavailable (Network error) - {path}"
        return ResponseManager.bad_gateway(message=msg)

    if resp.status_code == 204 or not resp.content:
        return ResponseManager.no_content(message="No content from upstream service")

    # Try JSON decode
    try:
        current_app.logger.debug(resp)
        payload = resp.json()
    except ValueError:
        current_app.logger.error(f"❌ Non-JSON response from {url}: {resp.text[:2000]}")
        return ResponseManager.error("Invalid response from service", status=502)

    # Validate JSON schema
    if not isinstance(payload, dict) or "success" not in payload:
        current_app.logger.error(f"❌ Bad response format from {url}: {payload}")
        return ResponseManager.error("Invalid service payload", status=502)

    # current_app.logger.debug(
    #    f"🔵 Service call {method} {path} returned {status} with payload:\n"
    #    f"{json.dumps(payload, indent=2, ensure_ascii=False)}"
    # )

    # Build unified Flask response
    return ResponseManager._build(
        success=payload.get("success"),
        status=status,
        message=payload.get("message"),
        error=payload.get("error"),
        data=payload.get("data"),
    )

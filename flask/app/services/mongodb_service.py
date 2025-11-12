# app/services/mongodb_service.py
import time
import requests
from flask import current_app

from ..managers.response_management import ResponseManager



# ------------------------ Core ------------------------

def get_mongodb_url():
    return current_app.config["MONGODB_SERVICE_URL"]

def _ping_service():
    """Check if the MongoDB service is reachable."""
    resp = requests.get(f"{get_mongodb_url()}/healthz", timeout=3)
    if resp.status_code == 200:
        return ResponseManager.success(message="MongoDB service reachable")
    else:
        return ResponseManager.error(error=f"MongoDB service unhealthy (status {resp.status_code})")

def _safe_request(method: str, path: str, **kwargs) -> tuple:
    """ Safely perform an HTTP request to the MongoDB service. """
    url = f"{get_mongodb_url()}{path}"
    start = time.perf_counter()
    
    resp = requests.request(method, url, timeout=8, **kwargs)
    elapsed = (time.perf_counter() - start) * 1000

    status = resp.status_code

    # Try to parse response JSON
    payload = resp.json()

    if not isinstance(payload, dict) or "success" not in payload:
        raise ValueError(f"Unexpected response format from {path}: {payload}")
    
    current_app.logger.debug(f"⏱️ [{method}] {path} took {elapsed:.2f} ms (status {status})")

    return ResponseManager._build(
        success=payload.get("success"),
        status=status,
        message=payload.get("message"),
        error=payload.get("error"),
        data=payload.get("data")
    )


# ------------------------ Index Management ------------------------

def ensure_indexes(db_name: str) -> tuple:
    """Trigger the remote Mongo service to create all known indexes."""
    return _safe_request("POST", "/ensure_indexes", json={
        "db_name": db_name
    })


# ---------------------- Entity Get ----------------------

def get_entity(entity: str,
               office_serial: int = None,
               filters: dict = None,
               projection: dict = None,
               sort: tuple[str, int] = None,
               limit: int = 0,
               expand: bool = False
               ) -> tuple:
    """
    Generic wrapper to fetch entities (users, clients, files, cases)
    from the MongoDB microservice with optional expansion flags.

    Args:
        entity (str): Collection name (e.g., 'cases', 'users', etc.)
        office_serial (int, optional): Tenant DB serial
        filters (dict, optional): Query filter to match target documents
        projection (dict, optional): Fields to include/exclude in results
        sort (tuple, optional): Sort order as (field, direction)
        limit (int): Max number of documents to return (0 = no limit)
        expand (bool): Whether to expand related fields in the response
    Returns:
        tuple: ResponseManager-compatible response
    """
    return _safe_request("POST", "/get_entity", json={
        "entity": entity,
        "office_serial": office_serial,
        "filters": filters,
        "projection": projection,
        "sort": list(sort) if sort else None,
        "limit": limit,
        "expand": expand
    })

# ---------------------- Entity Create ----------------------

def create_entity(entity: str,
                  office_serial: int,
                  document: dict,
                  expand: bool = False) -> tuple:
    """
    Create a new document in the MongoDB service for the given tenant and entity.
    Automatically assigns a serial based on entity type.

    Args:
        entity (str): Collection name (e.g., 'cases', 'users', etc.)
        office_serial (int): Tenant DB serial
        document (dict): Document data to insert
        expand (bool): Whether to expand related fields in the response
    Returns:
        tuple: ResponseManager-compatible response
    """
    return _safe_request("POST", "/create_entity", json={
        "entity": entity,
        "office_serial": office_serial,
        "document": document,
        "expand": expand
    })

# ---------------------- Entity Delete ----------------------

def delete_entity(entity: str,
                  office_serial: int = None,
                  filters: dict = None
                  ) -> tuple:
    """
    Generic wrapper to delete entities (users, clients, files, cases)
    from the MongoDB microservice using provided filters.

    Args:
        entity (str): Collection name (e.g., 'cases', 'users', etc.)
        office_serial (int, optional): Tenant DB serial
        filters (dict): Query filter to match target documents
    Returns:
        tuple: ResponseManager-compatible response
    """
    return _safe_request("DELETE", "/delete_entity", json={
        "entity": entity,
        "office_serial": office_serial,
        "filters": filters
    })

# ---------------------- Entity Update ----------------------
def update_entity(entity: str,
                  office_serial: int = None,
                  filters: dict = None,
                  update_data: dict = None,
                  *,
                  multiple: bool = False,
                  operator: str = "$set") -> tuple:
    """
    Generic wrapper to update entities (users, clients, files, cases)
    in the MongoDB microservice using provided filters and update data.

    Args:
        entity (str): Collection name (e.g., 'cases', 'users', etc.)
        office_serial (int, optional): Tenant DB serial
        filters (dict): Query filter to match target documents
        update_data (dict): Data to apply under the given operator
        multiple (bool): Whether to update multiple documents
        operator (str): MongoDB operator, default "$set"
    Returns:
        tuple: ResponseManager-compatible response
    """
    return _safe_request("PATCH", "/update_entity", json={
        "entity": entity,
        "office_serial": office_serial,
        "filters": filters,
        "update_data": update_data,
        "multiple": multiple,
        "operator": operator
    })


# ------------------------ Counters ------------------------


# ---------- Tenant counters ----------
def get_user_counter(db_name: str) -> tuple:
    """Increment and return the user counter for a specific tenant DB."""
    return _safe_request("GET", "/get_user_counter", params={
        "db_name": db_name
    })

def get_case_counter(db_name: str) -> tuple:
    """Increment and return the user counter for a specific tenant DB."""
    return _safe_request("GET", "/get_case_counter", params={
        "db_name": db_name
    })

def get_client_counter(db_name: str) -> tuple:
    """Increment and return the user counter for a specific tenant DB."""
    return _safe_request("GET", "/get_client_counter", params={
        "db_name": db_name
    })

def get_file_counter(db_name: str) -> tuple:
    """Increment and return the user counter for a specific tenant DB."""
    return _safe_request("GET", "/get_file_counter", params={
        "db_name": db_name
    })


# ---------- Global office counter ----------
def get_offices_counter() -> tuple:
    """Increment and retrieve the global offices counter."""
    return _safe_request("GET", "/get_offices_counter", params={})


# ------------------------ Helpers ------------------------


# ---------- Tenant helpers ----------
def get_office_serial(office_name: str) -> tuple:
    """
    Return the serial (or ID) of an office by its name, via the MongoDB microservice.
    """
    return _safe_request("GET", "/get_office_serial", params={
        "office_name": office_name
    })

def get_office_name(office_serial: int) -> tuple:
    """
    Return the serial (or ID) of an office by its name, via the MongoDB microservice.
    """
    return _safe_request("GET", "/get_office_name", params={
        "office_serial": office_serial
    })

def get_or_create_office_serial(office_name: str) -> tuple:
    return _safe_request("GET", "/get_or_create_office_serial", params={
        "office_name": office_name
    })


# ---------------------- Login ----------------------

# ---------- Admin Login ----------
def get_admin_passwords_hashes() -> tuple:
    return _safe_request("GET", "/get_admin_passwords_hashes", params={})

def admin_login(password: str) -> tuple:
    return _safe_request("POST", "/admin_login", json={
        "password": password
    })

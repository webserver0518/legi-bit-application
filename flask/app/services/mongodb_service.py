# app/services/mongodb_service.py
import time
import requests
from flask import current_app

from ..managers.response_management import ResponseManager
from .http_client import safe_service_request


# ------------------------ Core ------------------------


def get_mongodb_url():
    return current_app.config["MONGODB_SERVICE_URL"]


def _ping_service():
    """Check if the MongoDB service is reachable."""
    resp = requests.get(f"{get_mongodb_url()}/healthz", timeout=3)
    if resp.status_code == 200:
        msg = "MongoDB service reachable"
        return ResponseManager.success(message=msg)
    else:
        msg = f"MongoDB service unhealthy (status {resp.status_code})"
        return ResponseManager.error(message=msg)


def _safe_request(method: str, path: str, **kwargs) -> tuple:
    """Safely perform an HTTP request to the S3 service."""
    return safe_service_request(
        service_url=get_mongodb_url(), method=method, path=path, **kwargs
    )


# ------------------------ Index Management ------------------------


def ensure_indexes(db_name: str) -> tuple:
    """Trigger the remote Mongo service to create all known indexes."""
    return _safe_request("POST", "/ensure_indexes", json={"db_name": db_name})


# ---------------------- ENTITIES ----------------------


def search_entities(
    entity: str,
    office_serial: int = None,
    filters: dict = None,
    projection: dict = None,
    sort: tuple[str, int] = None,
    limit: int = 0,
    expand: bool = False,
) -> tuple:
    """POST /entities/search"""
    return _safe_request(
        "POST",
        "/entities/search",
        json={
            "entity": entity,
            "office_serial": office_serial,
            "filters": filters,
            "projection": projection,
            "sort": list(sort) if sort else None,
            "limit": int(limit) if limit else 0,
            "expand": bool(expand),
        },
    )

def create_entity(
    entity: str, 
    office_serial: int, 
    document: dict
) -> tuple:
    """POST /entities"""
    return _safe_request(
        "POST",
        "/entities",
        json={
            "entity": entity,
            "office_serial": office_serial,
            "document": document
        },
    )


def update_entities(
    entity: str,
    office_serial: int = None,
    filters: dict = None,
    update_data: dict = None,
    multiple: bool = False,
    operator: str = "$set",
) -> tuple:
    """PATCH /entities/update"""
    return _safe_request(
        "PATCH",
        "/entities/update",
        json={
            "entity": entity,
            "office_serial": office_serial,
            "filters": filters,
            "update_data": update_data,
            "multiple": bool(multiple),
            "operator": operator,
        },
    )

def delete_entities(
    entity: str, 
    office_serial: int = None, 
    filters: dict = None
) -> tuple:
    """PATCH /entities/delete"""
    return _safe_request(
        "DELETE",
        "/entities/delete",
        json={
            "entity": entity,
            "office_serial": office_serial,
            "filters": filters,
        },
    )


# ------------------------ Counters ------------------------


def get_user_counter(db_name: str) -> tuple:
    """Increment and return the user counter for a specific tenant DB."""
    return _safe_request("GET", "/counters/users", params={"db_name": db_name})


def get_case_counter(db_name: str) -> tuple:
    """Increment and return the user counter for a specific tenant DB."""
    return _safe_request("GET", "/counters/cases", params={"db_name": db_name})


def get_client_counter(db_name: str) -> tuple:
    """Increment and return the user counter for a specific tenant DB."""
    return _safe_request("GET", "/counters/clients", params={"db_name": db_name})


def get_file_counter(db_name: str) -> tuple:
    """Increment and return the user counter for a specific tenant DB."""
    return _safe_request("GET", "/counters/files", params={"db_name": db_name})


def get_offices_counter() -> tuple:
    """Increment and retrieve the global offices counter."""
    return _safe_request("GET", "/counters/offices", params={})


# ------------------------ OFFICES ------------------------


def search_offices(
        filters: dict = None,
        projection: dict = None,
        sort: tuple[str, int] = None,
        limit: int = 0,
    ) -> tuple:
    """POST /offices/search"""
    return _safe_request(
        "POST",
        "/offices/search",
        json={
            "filters": filters,
            "projection": projection,
            "sort": list(sort) if sort else None,
            "limit": int(limit) if limit else 0,
        }
    )


def create_office(name: str) -> tuple:
    """POST /offices"""
    return _safe_request("POST", "/offices", json={"name": name})

def delete_office(serial: int) -> tuple:
    """DELETE /offices/<serial>"""
    return _safe_request("DELETE", f"/offices/{int(serial)}", json={})


# ---------------------- ADMIN ----------------------


def get_admin_passwords() -> tuple:
    """GET /admin/passwords"""
    return _safe_request("GET", "/admin/passwords", params={})


def admin_login(password: str) -> tuple:
    """POST /admin/login"""
    return _safe_request("POST", "/admin/login", json={"password": password})

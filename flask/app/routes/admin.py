from datetime import datetime, timezone
from werkzeug.security import check_password_hash
from flask import Blueprint, render_template, request, flash, current_app

from ..services import mongodb_service, s3_service
from ..managers.response_management import ResponseManager
from ..managers.json_management import JSONManager
from ..managers.auth_management import AuthorizationManager
from ..managers.mfa_manager import MFAManager
from ..constants.constants_mongodb import MongoDBEntity, MongoDBFilters, MongoDBData

admin_bp = Blueprint("admin", __name__)


# ---------------- DASHBOARD ---------------- #


@admin_bp.route("/base_admin_dashboard")
def base_admin_dashboard():
    return render_template("base_admin_dashboard.html")


# ---------------- USER MANAGEMENT ---------------- #


@admin_bp.route("/get_offices", methods=["GET"])
def get_offices():
    current_app.logger.debug("🟦 [get_offices] Fetching all offices")

    get_res = mongodb_service.get_offices()

    if not ResponseManager.is_success(response=get_res):
        current_app.logger.debug("Internal Server Error", "danger")
        return get_res

    data = ResponseManager.get_data(response=get_res)
    if not data:
        return ResponseManager.not_found(error="Case not found")

    current_app.logger.debug(f"Returning success with data={data}")
    return ResponseManager.success(data=data)


@admin_bp.route("/create_new_office", methods=["POST"])
def create_new_office():
    current_app.logger.debug("🟦 [new_offices] creating new office")
    payload = request.get_json(silent=True) or {}
    office_name = (payload.get("office_name") or "").strip()

    create_res = mongodb_service.create_new_office(office_name)

    if not ResponseManager.is_success(response=create_res):
        current_app.logger.debug("Internal Server Error", "danger")
        return create_res

    data = ResponseManager.get_data(response=create_res)
    if not data:
        return ResponseManager.not_found(error="no new office serial returned")

    current_app.logger.debug(f"Returning success with data={data}")
    return ResponseManager.success(data=data)


# ---------------- LOADERS ---------------- #


@admin_bp.route("/load_search_office")
def load_search_office():
    return render_template("admin_components/search_office.html")


@admin_bp.route("/load_new_office")
def load_new_office():
    return render_template("admin_components/new_office.html")


@admin_bp.route("/load_view_office")
def load_view_office():
    return render_template("admin_components/view_office.html")


@admin_bp.route("/get_roles_list")
def get_roles_list():

    try:
        return JSONManager.jsonify("roles.json")
    except Exception as e:
        current_app.logger.error(f"❌ load_users_management error: {e}")
        return ResponseManager.error(str(e))

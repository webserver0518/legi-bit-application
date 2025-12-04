from datetime import datetime, timezone
from werkzeug.security import check_password_hash
from flask import Blueprint, render_template, request, flash, current_app

from ..services import mongodb_service, s3_service
from ..services.webrtc_service import webrtc_store, WebRTCStoreUnavailable

from ..managers.response_management import ResponseManager
from ..managers.json_management import JSONManager
from ..managers.auth_management import AuthorizationManager
from ..managers.mfa_manager import MFAManager

from ..constants.constants_mongodb import MongoDBEntity, MongoDBFilters, MongoDBData

admin_bp = Blueprint("admin", __name__)


# ---------------- DASHBOARD ---------------- #


@admin_bp.route("/base_admin_dashboard")
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def base_admin_dashboard():
    roles = AuthorizationManager.get_roles()
    return render_template("base_admin_dashboard.html", roles=roles)


# ---------------- OFFICES MANAGEMENT ---------------- #


@admin_bp.route("/search_offices", methods=["GET"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def search_offices():
    current_app.logger.debug("🟦 [search_offices] Fetching all offices")

    get_res = mongodb_service.search_offices()

    if not ResponseManager.is_success(response=get_res):
        current_app.logger.debug("Internal Server Error", "danger")
        return get_res

    data = ResponseManager.get_data(response=get_res)
    if not data:
        return ResponseManager.not_found(error="No offices found")

    current_app.logger.debug(f"Returning success with data={data}")
    return ResponseManager.success(data=data)


@admin_bp.route("/create_office", methods=["POST"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def create_office():
    current_app.logger.debug("🟦 [new_offices] creating office")

    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()

    if not name:
        current_app.logger.debug("⚠️ [new_offices] missing name in payload")
        return ResponseManager.bad_request(error="name is required")

    create_res = mongodb_service.create_office(name)

    if not ResponseManager.is_success(response=create_res):
        current_app.logger.debug("Internal Server Error", "danger")
        return create_res

    data = ResponseManager.get_data(response=create_res)
    if not data:
        return ResponseManager.not_found(error="no new office serial returned")

    current_app.logger.debug(f"Returning success with data={data}")
    return ResponseManager.success(data=data)


# ---------------- LOADERS ---------------- #


@admin_bp.route("/load_birds_view_offices")
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def load_birds_view_offices():
    return render_template("admin_components/birds_view_offices.html")


@admin_bp.route("/load_search_office")
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def load_search_office():
    return render_template("admin_components/search_office.html")


@admin_bp.route("/load_new_office")
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def load_new_office():
    return render_template("admin_components/new_office.html")


@admin_bp.route("/load_view_office")
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def load_view_office():
    return render_template("admin_components/view_office.html")


@admin_bp.route("/load_admin_remote_control")
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def load_admin_remote_control():
    return render_template("admin_components/admin_remote_control.html")


@admin_bp.route("/get_roles_list")
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def get_roles_list():

    try:
        return JSONManager.jsonify("roles.json")
    except Exception as e:
        current_app.logger.error(f"❌ load_users_management error: {e}")
        return ResponseManager.error(str(e))



# ---------------- WebRTC for Remote Support ---------------- #

@admin_bp.route("/admin/webrtc/join", methods=["POST"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def admin_webrtc_join():
    try:
        store = webrtc_store()
    except WebRTCStoreUnavailable as e:
        current_app.logger.error(f"[WebRTC] store unavailable in admin_webrtc_join: {e}")
        return ResponseManager.internal("WebRTC is currently unavailable (Redis offline or not configured).")

    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    if not code:
        return ResponseManager.bad_request("Missing 'code'")

    offer = store.get_offer(code)
    if not offer:
        return ResponseManager.not_found("Offer not ready (wrong code or user hasn't started sharing)")

    meta = store.get_meta(code) or {}
    return ResponseManager.success(data={"offer": offer, "meta": meta})


@admin_bp.route("/admin/webrtc/answer", methods=["POST"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def admin_webrtc_answer():
    try:
        store = webrtc_store()
    except WebRTCStoreUnavailable as e:
        current_app.logger.error(f"[WebRTC] store unavailable in admin_webrtc_answer: {e}")
        return ResponseManager.internal(
            "WebRTC is currently unavailable (Redis offline or not configured)."
        )

    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    answer = data.get("answer")

    if not code or not answer:
        return ResponseManager.bad_request("Missing 'code' or 'answer'")

    if not store.set_answer(code, answer):
        return ResponseManager.not_found("Invalid or expired code")

    current_app.logger.info(f"[WebRTC] Admin set answer for code={code}")
    return ResponseManager.success(data={"ok": True})


@admin_bp.route("/admin/webrtc/pending", methods=["GET"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def admin_webrtc_pending():
    try:
        store = webrtc_store()
        items = store.list_pending(limit=50)  # [{ code, meta, created_at, expires_at, ttl_left }]
        return ResponseManager.success(data={"items": items})
    except WebRTCStoreUnavailable as e:
        current_app.logger.error(f"[WebRTC] store unavailable in admin_webrtc_pending: {e}")
        return ResponseManager.internal("לא ניתן למשוך רשימת ממתינים כרגע.")
    except Exception as e:
        current_app.logger.exception(f"[WebRTC] failed to fetch pending list: {e}")
        return ResponseManager.internal("אירעה שגיאה בשליפת רשימת הממתינים.")


@admin_bp.route("/admin/webrtc/extend", methods=["POST"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def admin_webrtc_extend():
    try:
        store = webrtc_store()
    except WebRTCStoreUnavailable:
        return ResponseManager.internal("WebRTC unavailable")

    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    minutes = int(data.get("minutes") or 0)
    if not code or minutes <= 0:
        return ResponseManager.bad_request("Missing 'code' or invalid 'minutes'")

    ttl_left = store.extend(code, minutes * 60)
    return ResponseManager.success(data={"ttl_left": ttl_left})

@admin_bp.route("/admin/webrtc/delete", methods=["DELETE", "POST"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def admin_webrtc_delete():
    try:
        store = webrtc_store()
    except WebRTCStoreUnavailable:
        return ResponseManager.internal("WebRTC unavailable")

    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip() or request.args.get("code","").strip()
    if not code:
        return ResponseManager.bad_request("Missing 'code'")

    store.delete(code)
    return ResponseManager.success(data={"ok": True})






# --- יצירת משתמש: POST /admin/users ---
@admin_bp.route("/admin/users", methods=["POST"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def admin_create_user():
    payload = request.get_json(silent=True) or {}
    office_serial = payload.get("office_serial")
    username     = (payload.get("username") or "").strip()
    full_name    = (payload.get("full_name") or "").strip()
    email        = (payload.get("email") or "").strip() or None
    password     = (payload.get("password") or "").strip()
    roles        = payload.get("roles") or []

    # בדיקות מינימום
    if not office_serial:
        return ResponseManager.bad_request("office_serial is required")
    try:
        office_serial = int(office_serial)
    except (TypeError, ValueError):
        return ResponseManager.bad_request("office_serial must be int")

    if not username or not full_name or not password:
        return ResponseManager.bad_request("username, full_name and password are required")

    # בדיקת ייחודיות username בתוך המשרד
    exists_res = mongodb_service.search_entities(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters={"username": username},
        limit=1
    )
    if not ResponseManager.is_success(exists_res):
        return ResponseManager.bad_gateway("Failed to check username uniqueness")

    if (ResponseManager.get_data(exists_res) or []):
        return ResponseManager.conflict("username already exists in this office")

    # יצירת המסמך
    doc = {
        "username": username,
        "full_name": full_name,
        "email": email,
        "roles": roles if isinstance(roles, list) else [],
        "active": True,
        "password_hash": generate_password_hash(password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    create_res = mongodb_service.create_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        document=doc
    )
    if not ResponseManager.is_success(create_res):
        # מחזיר את שגיאת המיקרו־סרוויס כמו שהיא
        return create_res

    return ResponseManager.success(
        data=ResponseManager.get_data(create_res),
        message="User created"
    )


# --- מחיקת משתמש: DELETE /admin/users?office_serial=..&user_serial=.. ---
@admin_bp.route("/admin/users", methods=["DELETE"])
@AuthorizationManager.login_required
@AuthorizationManager.admin_required
def admin_delete_user():
    # נקרא קודם מ-query string, ואז מהריקווסט-בודי (תאימות)
    args = request.args
    body = request.get_json(silent=True) or {}
    office_serial = args.get("office_serial", body.get("office_serial"))
    user_serial   = args.get("user_serial", body.get("user_serial"))

    if not office_serial or not user_serial:
        return ResponseManager.bad_request("office_serial and user_serial are required")

    try:
        office_serial = int(office_serial)
        user_serial   = int(user_serial)
    except (TypeError, ValueError):
        return ResponseManager.bad_request("office_serial and user_serial must be int")

    # אופציונלי: חסימת מחיקת עצמך (כדי לא לירות לעצמך ברגל)
    current_user_serial = AuthorizationManager.get_user_serial()
    if current_user_serial and int(current_user_serial) == user_serial:
        return ResponseManager.forbidden("You cannot delete your own user")

    delete_res = mongodb_service.delete_entities(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters={"serial": user_serial}
    )

    if ResponseManager.is_no_content(delete_res):
        # לא נמצא – אפשר להחזיר 204/200; נשמור על עקביות
        return delete_res

    if not ResponseManager.is_success(delete_res):
        return delete_res

    return ResponseManager.success(message="User deleted")


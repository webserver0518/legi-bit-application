# app/routes/user.py
from datetime import datetime, timezone
from werkzeug.security import check_password_hash
from flask import Blueprint, render_template, request, flash, current_app

from ..services import mongodb_service, s3_service
from ..managers.response_management import ResponseManager
from ..managers.json_management import JSONManager
from ..managers.auth_management import AuthorizationManager
from ..managers.mfa_manager import MFAManager
from ..constants.constants_mongodb import MongoDBEntity, MongoDBFilters, MongoDBData

user_bp = Blueprint("user", __name__)


@user_bp.route("/auth_debug")
def auth_debug():
    """Show all current auth variables for debugging."""
    return AuthorizationManager.get()


# ---------------- HELPERS ---------------- #
@user_bp.route("/presign/post", methods=["POST"])
def proxy_presign_post():
    """
    Proxy route – frontend -> backend -> S3 service
    """
    data = request.get_json()
    file_name = data.get("file_name")
    file_type = data.get("file_type")
    file_size = data.get("file_size")
    key = data.get("key")

    if not all([file_name, file_type, file_size, key]):
        return ResponseManager.bad_request("Missing required fields")

    s3_res = s3_service.generate_presigned_post(
        filename=file_name, filetype=file_type, filesize=file_size, key=key
    )

    return s3_res


# ---------------- BASE DASHBOARD ---------------- #


@user_bp.route("/base_user_dashboard")
@AuthorizationManager.login_required
def base_user_dashboard():
    return render_template(
        "base_user_dashboard.html", username=AuthorizationManager.get_username()
    )


# ---------------- Office MANAGEMENT ---------------- #


@user_bp.route("/get_office_name")
def get_office_name():
    """Return the current logged-in office name from auth"""
    office_name = AuthorizationManager.get_office_name()
    if not office_name:
        current_app.logger.debug("No office name found")
        return "Not Found"
    else:
        return office_name


@user_bp.route("/get_office_serial", methods=["GET"])
def get_office_serial():
    office_serial = AuthorizationManager.get_office_serial()
    if not office_serial:
        return ResponseManager.bad_request("Missing office_serial in auth")
    return ResponseManager.success(data={"office_serial": office_serial})


# ---------------- User MANAGEMENT ---------------- #
@user_bp.route("/get_username")
def get_username():
    """Return the current logged-in office name from auth"""
    user_full_name = AuthorizationManager.get_username()
    if not user_full_name:
        current_app.logger.debug("No user full name found")
        return "Not Found"
    else:
        return user_full_name


@user_bp.route("/get_user_serial", methods=["GET"])
def get_user_serial():
    """Return the current logged-in user's serial."""
    user_serial = AuthorizationManager.get_user_serial()
    if not user_serial:
        current_app.logger.debug("No user_serial found in session")
        return ResponseManager.bad_request("Missing 'user_serial' in auth")
    return ResponseManager.success(data={"user_serial": user_serial})


@user_bp.route("/get_office_users", methods=["GET"])
def get_office_users():
    """
    Return all users (staff) for the current office
    for selection as 'responsible' in case creation.
    """
    office_serial = AuthorizationManager.get_office_serial()
    if not office_serial:
        current_app.logger.debug("returning bad_request: 'office_serial' is required")
        return ResponseManager.error("Missing 'office_serial' in auth")

    users_res = mongodb_service.get_entity(
        entity=MongoDBEntity.USERS, office_serial=office_serial
    )

    if ResponseManager.is_not_found(users_res):
        current_app.logger.debug("⚠️ No users found, returning empty list")
        return ResponseManager.success(data=[])

    if not ResponseManager.is_success(users_res):
        return ResponseManager.internal("Failed to fetch office users")

    users_data = ResponseManager.get_data(users_res)
    users = [u.get("users") for u in users_data]
    current_app.logger.debug(f"✅ Returning {len(users)} users")
    return ResponseManager.success(data=users)


# ---------------- FILES MANAGEMENT ---------------- #


@user_bp.route("/create_new_file", methods=["POST"])
def create_new_file():
    current_app.logger.debug("inside create_new_file()")

    office_serial = AuthorizationManager.get_office_serial()
    user_serial = AuthorizationManager.get_user_serial()
    if not office_serial:
        current_app.logger.debug("returning bad_request: 'office_serial' is required")
        return ResponseManager.bad_request("Missing 'office_serial' in auth")
    if not user_serial:
        current_app.logger.debug("returning bad_request: 'user_serial' is required")
        return ResponseManager.bad_request("Missing 'user_serial' in auth")

    data = request.get_json(force=True)
    if not data:
        current_app.logger.debug("returning bad_request: Missing request JSON")
        return ResponseManager.bad_request("Missing request JSON")

    new_file_doc = {
        "created_at": data.get("created_at"),
        "user_serial": user_serial,
        "case_serial": data.get("case_serial"),
        "client_serial": data.get("client_serial"),
        "name": data.get("name"),
        "technical_type": data.get("technical_type"),
        "content_type": data.get("content_type"),
        "description": data.get("description"),
        "status": "pending",
    }

    new_file_res = mongodb_service.create_entity(
        entity=MongoDBEntity.FILES, office_serial=office_serial, document=new_file_doc
    )

    if not ResponseManager.is_success(new_file_res):
        current_app.logger.debug(f"Failed to create file")
        return ResponseManager.internal(f"Failed to create file")

    new_file_serial = ResponseManager.get_data(new_file_res)
    current_app.logger.debug(f"Created new file with serial={new_file_serial}")
    return ResponseManager.success(data=new_file_serial)


@user_bp.route("/update_file", methods=["PATCH"])
def update_file():
    office_serial = AuthorizationManager.get_office_serial()
    if not office_serial:
        return ResponseManager.bad_request("Missing 'office_serial' in auth")

    file_serial = int(request.args.get("serial"))
    if not file_serial:
        return ResponseManager.bad_request("Missing file serial")

    update_data = request.get_json(force=True) or {}
    if not update_data:
        return ResponseManager.bad_request("Missing update payload")

    res = mongodb_service.update_entity(
        entity=MongoDBEntity.FILES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(file_serial)),
        update_data=update_data,
    )

    if not ResponseManager.is_success(res):
        return ResponseManager.internal("Failed to update file")

    return ResponseManager.success()


@user_bp.route("/get_file_url", methods=["GET"])
def get_file_url():
    """
    Generate a temporary presigned GET URL for viewing a file from S3.
    Expected query parameters:
        - case_serial
        - file_serial
        - file_name
    office_serial is retrieved automatically from the user's auth.
    """
    office_serial = AuthorizationManager.get_office_serial()
    case_serial = request.args.get("case_serial")
    file_serial = request.args.get("file_serial")
    file_name = request.args.get("file_name")

    if not office_serial:
        current_app.logger.error("Missing 'office_serial' in auth")
        return ResponseManager.error("Missing 'office_serial' in auth")
    if not file_serial:
        current_app.logger.error("Missing 'file_serial'")
        return ResponseManager.error("Missing 'file_serial'")
    if not file_name:
        current_app.logger.error("Missing 'file_name'")
        return ResponseManager.error("Missing 'file_name'")

    # 🧩 Build key using standard naming convention
    key = f"uploads/{office_serial}/{case_serial}/{file_serial}/{file_name}"
    current_app.logger.debug(f"🔑 [get_file_url] Generated key: {key}")

    # 🧠 Request presigned URL from S3 service
    s3_res = s3_service.generate_presigned_get(key)
    if not ResponseManager.is_success(response=s3_res):
        current_app.logger.error(
            f"❌ [get_file_url] S3 service error: {s3_res['error']}"
        )
        return s3_res

    presigned_url = ResponseManager.get_data(response=s3_res)
    current_app.logger.debug(
        f"✅ [get_file_url] Returning presigned URL for key: {key}"
    )
    return ResponseManager.success(data=presigned_url)


@user_bp.route("/delete_file", methods=["DELETE"])
def delete_file():
    """
    Delete a file:
      1. Validate auth + params
      2. Delete from S3
      3. Delete from MongoDB (FILES collection)
    """

    office_serial = AuthorizationManager.get_office_serial()
    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")

    case_serial = request.args.get("case_serial")
    file_serial = request.args.get("file_serial")
    file_name = request.args.get("file_name")

    if not case_serial:
        return ResponseManager.bad_request("Missing 'case_serial'")
    if not file_serial:
        return ResponseManager.bad_request("Missing 'file_serial'")
    if not file_name:
        return ResponseManager.bad_request("Missing 'file_name'")

    # Normalize
    file_serial = int(file_serial)
    case_serial = int(case_serial)

    # ----------------------------------------------------
    # Build S3 key
    # ----------------------------------------------------
    key = f"uploads/{office_serial}/{case_serial}/{file_serial}/{file_name}"
    current_app.logger.debug(f"🗑️ [delete_file] Deleting key: {key}")

    # ----------------------------------------------------
    # Delete from S3
    # ----------------------------------------------------
    s3_res = s3_service.delete(key)
    if not ResponseManager.is_success(s3_res):
        current_app.logger.error(
            f"❌ [delete_file] Failed to delete from S3: {s3_res['error']}"
        )
        return s3_res

    # ----------------------------------------------------
    # Delete from Mongo (FILES entity)
    # ----------------------------------------------------
    mongo_res = mongodb_service.delete_entity(
        entity=MongoDBEntity.FILES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(file_serial),
    )

    if not ResponseManager.is_success(mongo_res):
        current_app.logger.error(
            f"❌ [delete_file] Failed to delete Mongo file serial={file_serial}"
        )
        # File already deleted from S3 — but object remains in DB
        return mongo_res

    # ----------------------------------------------------
    # Remove file_serial from CASE.files_serials
    # ----------------------------------------------------
    case_update_res = mongodb_service.update_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(case_serial),
        operator="$pull",
        update_data={"files_serials": file_serial},
    )

    if not ResponseManager.is_success(case_update_res):
        current_app.logger.error(
            f"❌ [delete_file] Failed to pull file_serial={file_serial} from case={case_serial}"
        )

    current_app.logger.info(
        f"🟢 [delete_file] File serial={file_serial} deleted successfully"
    )
    return ResponseManager.success(message="File deleted")


@user_bp.route("/get_office_files", methods=["GET"])
def get_office_files():
    """
    Return all files for the current office with full basic details
    (for dropdown + table auto-fill).
    """
    office_serial = AuthorizationManager.get_office_serial()
    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")

    files_res = mongodb_service.get_entity(
        entity=MongoDBEntity.FILES,
        office_serial=office_serial,
        filters=None,
    )

    if not ResponseManager.is_success(files_res):
        return ResponseManager.internal("Failed to fetch clients")

    files = ResponseManager.get_data(files_res)
    return ResponseManager.success(data=files)


@user_bp.route("/update_file_description", methods=["POST"])
def update_file_description():
    """
    Update only the 'description' field of a file by its serial.
    Body JSON:
      { "file_serial": <int>, "description": "<string>" }
    """
    office_serial = AuthorizationManager.get_office_serial()
    if not office_serial:
        return ResponseManager.bad_request("Missing 'office_serial' in auth")

    payload = request.get_json(silent=True) or {}
    file_serial = payload.get("file_serial")
    description = (payload.get("description") or "").strip()

    if not file_serial:
        return ResponseManager.bad_request("file_serial is required")

    # בונה עדכון מינימלי; אם תרצה גם updated_at – הוסף כאן
    update_data = {"description": description}

    res = mongodb_service.update_entity(
        entity=MongoDBEntity.FILES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(file_serial)),
        update_data=update_data,
        multiple=False,
        operator="$set",
    )

    if not ResponseManager.is_success(res):
        return ResponseManager.internal("Failed to update file description")

    return ResponseManager.success(message="File description updated")


# ---------------- CASES MANAGEMENT ---------------- #


@user_bp.route("/get_case")
def get_case():
    office_serial = AuthorizationManager.get_office_serial()
    case_serial = request.args.get("serial")
    expand = request.args.get("expand", False)

    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")
    if not case_serial:
        return ResponseManager.bad_request("Missing 'case_serial'")

    case_serial = int(case_serial)
    current_app.logger.debug(
        f"🟦 [get_case] Fetching case={case_serial} expand={expand}"
    )

    case_res = mongodb_service.get_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(case_serial),
        limit=1,
        expand=expand,
    )

    if not ResponseManager.is_success(response=case_res):
        current_app.logger.debug("Internal Server Error", "danger")
        return case_res

    data = ResponseManager.get_data(response=case_res)
    if not data:
        return ResponseManager.not_found(error="Case not found")

    current_app.logger.debug(f"✅ Returning case serial={case_serial}")
    return ResponseManager.success(data=data)


@user_bp.route("/get_office_cases")
def get_office_cases():
    """
    Return cases for a given office, supporting:
    - title_tokens (split words, AND match)
    - client_tokens (split words, match any token in first/last name)
    - field
    - status
    """
    current_app.logger.debug("🟦 [get_office_cases] entered")

    office_serial = AuthorizationManager.get_office_serial()
    expand = request.args.get("expand", False)
    if not office_serial:
        current_app.logger.error("Missing office_serial in auth")
        return ResponseManager.error("Missing office_serial in auth")

    # --- Extract query params ---
    title_tokens = request.args.getlist("title_tokens")
    client_tokens = request.args.getlist("client_tokens")
    field = request.args.get("field")
    status = request.args.get("status")

    current_app.logger.debug(
        f"📥 Params → title_tokens={title_tokens}, client_tokens={client_tokens}, field={field}, status={status}"
    )

    filters = {}

    # --- Fetch cases ---
    cases_res = mongodb_service.get_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=filters or None,
        expand=expand,
    )

    if ResponseManager.is_not_found(cases_res):
        current_app.logger.debug("⚠️ No cases found, returning empty list")
        return ResponseManager.success(data=[])

    if not ResponseManager.is_success(cases_res):
        current_app.logger.error("❌ Error fetching cases from MongoDB service")
        return cases_res

    cases = ResponseManager.get_data(cases_res)
    current_app.logger.debug(f"✅ Returning {len(cases)} cases")
    return ResponseManager.success(data=cases)


@user_bp.route("/create_new_case", methods=["POST"])
def create_new_case():
    current_app.logger.debug("inside create_new_case()")

    office_serial = AuthorizationManager.get_office_serial()
    user_serial = AuthorizationManager.get_user_serial()
    if not office_serial:
        current_app.logger.debug("returning bad_request: 'office_serial' is required")
        return ResponseManager.bad_request("Missing 'office_serial' in auth")
    if not user_serial:
        current_app.logger.debug("returning bad_request: 'user_serial' is required")
        return ResponseManager.bad_request("Missing 'user_serial' in auth")

    data = request.get_json(force=True)
    if not data:
        current_app.logger.debug("returning bad_request: Missing request JSON")
        return ResponseManager.bad_request("Missing request JSON")

    # === Create all Clients ===
    clients_with_roles = data.get("clients_with_roles", [])
    if not clients_with_roles or not isinstance(clients_with_roles, list):
        current_app.logger.debug(
            "returning bad_request: No clients_with_roles provided"
        )
        return ResponseManager.bad_request("At least one client is required")

    clients_serials_with_roles = []  # { serial: role }

    for c in clients_with_roles:
        serial = c.get("client_serial")
        role = c.get("role")
        legal_role = c.get("legal_role")
        if not serial:
            return ResponseManager.bad_request(
                "Missing client_serial in one of the clients"
            )
        clients_serials_with_roles.append([str(serial), role, legal_role])

    # ✅ Ensure at least one main client exists
    has_main = any(role == "main" for _, role, _ in clients_serials_with_roles)
    if not has_main:
        current_app.logger.debug("returning bad_request: no main client found")
        return ResponseManager.bad_request("At least one main client is required")

    # === Create Case ===
    new_case_doc = {
        "created_at": data.get("created_at"),
        "user_serial": user_serial,
        "responsible_serial": data.get("responsible_serial"),
        "status": "active",
        "title": data.get("title"),
        "field": data.get("field"),
        "facts": data.get("facts", ""),
        "against": data.get("against"),
        "against_type": data.get("against_type"),
        "clients_serials_with_roles": clients_serials_with_roles,
        "files_serials": [],
    }

    current_app.logger.debug(f"new_case_doc: {new_case_doc}")

    # validation (basic)
    mandatory_fields = ("title",)
    missing_fields = [k for k in mandatory_fields if not new_case_doc.get(k, None)]
    if missing_fields:
        msg = f"Missing required fields for new case: {', '.join(missing_fields)}"
        current_app.logger.debug(msg)
        return ResponseManager.bad_request(msg)

    new_case_res = mongodb_service.create_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        document=new_case_doc,
    )
    if not ResponseManager.is_success(new_case_res):
        current_app.logger.debug("Failed to create case")
        return ResponseManager.internal("Failed to create case")

    new_case_serial = ResponseManager.get_data(new_case_res)
    current_app.logger.debug(
        f"Created new case with serial={new_case_serial} in office={office_serial}"
    )
    return ResponseManager.success(data=new_case_serial)


@user_bp.route("/delete_case", methods=["DELETE"])
def delete_case():
    office_serial = AuthorizationManager.get_office_serial()
    case_serial = request.args.get("serial")

    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")
    if not case_serial:
        return ResponseManager.bad_request("Missing 'case_serial'")

    case_serial = int(case_serial)

    # try to delete the case
    delete_res = mongodb_service.delete_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(case_serial),
    )

    if not ResponseManager.is_success(response=delete_res):
        current_app.logger.error(
            f"DELETE /delete_case | failed to delete case {case_serial} in office {office_serial}"
        )
        flash("failed to delete case", "danger")
        return delete_res

    current_app.logger.info(
        f"DELETE /delete_case | deleted case {case_serial} in office {office_serial}"
    )
    flash("case deleted", "success")
    return ResponseManager.success(message=f"Case {case_serial} deleted successfully")


@user_bp.route("/update_case", methods=["PATCH"])
def update_case():
    office_serial = AuthorizationManager.get_office_serial()
    case_serial = request.args.get("serial")
    update_data = request.get_json(force=True) or {}

    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")
    if not case_serial:
        return ResponseManager.bad_request("Missing 'case_serial'")
    if not update_data:
        return ResponseManager.bad_request("Missing 'update_data' in request body")

    case_serial = int(case_serial)

    current_app.logger.debug(
        f"PATCH /update_case | office={office_serial}, case={case_serial}, update={update_data}"
    )

    # perform the update via MongoDB microservice
    update_res = mongodb_service.update_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(case_serial),
        update_data=update_data,
        multiple=False,
    )

    if not ResponseManager.is_success(response=update_res):
        error = ResponseManager.get_error(response=update_res)
        current_app.logger.error(
            f"PATCH /update_case | failed to update case {case_serial}: {error}"
        )
        return update_res

    current_app.logger.info(
        f"PATCH /update_case | case {case_serial} updated successfully"
    )
    return ResponseManager.success(
        message=f"Case {case_serial} updated successfully",
        data=ResponseManager.get_data(update_res),
    )


@user_bp.route("/update_case_status", methods=["PATCH"])
def update_case_status():
    office_serial = AuthorizationManager.get_office_serial()
    case_serial = request.args.get("serial")
    payload = request.get_json(force=True) or {}
    new_status = payload.get("status")

    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")
    if not case_serial:
        return ResponseManager.bad_request("Missing 'case_serial'")
    if not new_status:
        return ResponseManager.bad_request("Missing 'status' in request body")

    case_serial = int(case_serial)

    update_data = MongoDBData.Case.status(new_status)
    if not update_data:
        return ResponseManager.bad_request(
            f"Invalid status '{new_status}'. Must be one of: active, archived"
        )

    current_app.logger.debug(
        f"PATCH /update_status | office={office_serial}, case={case_serial}, update={update_data}"
    )

    update_res = mongodb_service.update_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(case_serial),
        update_data=update_data,
        multiple=False,
    )

    if not ResponseManager.is_success(update_res):
        return update_res

    return ResponseManager.success(
        message=f"Case {case_serial} status updated to '{new_status}'",
        data=ResponseManager.get_data(update_res),
    )


# ---------------- CLIENTS MANAGEMENT ---------------- #


@user_bp.route("/create_new_client", methods=["POST"])
def create_new_client():
    """
    Create a new client document in MongoDB for the current office.
    """

    current_app.logger.debug("inside create_new_client()")

    office_serial = AuthorizationManager.get_office_serial()
    user_serial = AuthorizationManager.get_user_serial()

    if not office_serial:
        return ResponseManager.bad_request("Missing 'office_serial' in auth")
    if not user_serial:
        return ResponseManager.bad_request("Missing 'user_serial' in auth")

    data = request.get_json(force=True)
    if not data:
        return ResponseManager.bad_request("Missing request JSON")

    # ✅ ולידציה בסיסית
    # validation (basic)
    mandatory_fields = ("first_name",)
    missing_fields = [k for k in mandatory_fields if not data.get(k, None)]
    if missing_fields:
        msg = f"Missing required fields for new case: {', '.join(missing_fields)}"
        current_app.logger.debug(msg)
        return ResponseManager.bad_request(msg)

    # 🧱 בניית המסמך
    new_client_doc = {
        "created_at": data.get("created_at"),
        "user_serial": user_serial,
        "id_card_number": data.get("id_card_number"),
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "phone": data.get("phone"),
        "email": data.get("email"),
        "city": data.get("city"),
        "street": data.get("street"),
        "home_number": data.get("home_number"),
        "postal_code": data.get("postal_code"),
        "birth_date": data.get("birth_date"),
        "status": "active",
    }

    # 🧠 שמירה דרך Mongo microservice
    create_res = mongodb_service.create_entity(
        entity=MongoDBEntity.CLIENTS,
        office_serial=office_serial,
        document=new_client_doc,
    )

    if not ResponseManager.is_success(create_res):
        current_app.logger.error("❌ Failed to create client")
        return ResponseManager.internal("Failed to create client")

    new_client_serial = ResponseManager.get_data(create_res)
    current_app.logger.info(f"✅ Created new client serial={new_client_serial}")
    return ResponseManager.success(data=new_client_serial)


@user_bp.route("/update_client", methods=["PATCH"])
def update_client():
    """
    Update an existing client in MongoDB (CLIENTS entity).
    """
    office_serial = AuthorizationManager.get_office_serial()
    client_serial = request.args.get("serial")
    update_data = request.get_json(force=True) or {}

    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")
    if not client_serial:
        return ResponseManager.bad_request("Missing 'client_serial'")
    if not update_data:
        return ResponseManager.bad_request("Missing 'update_data' in request body")

    client_serial = int(client_serial)

    current_app.logger.debug(
        f"PATCH /update_client | office={office_serial}, client={client_serial}, update={update_data}"
    )

    # 🧠 עדכון דרך microservice
    update_res = mongodb_service.update_entity(
        entity=MongoDBEntity.CLIENTS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(client_serial),
        update_data=update_data,
        multiple=False,
    )

    if not ResponseManager.is_success(response=update_res):
        error = ResponseManager.get_error(response=update_res)
        current_app.logger.error(f"❌ Failed to update client {client_serial}: {error}")
        return update_res

    current_app.logger.info(f"🟢 Client {client_serial} updated successfully")
    return ResponseManager.success(
        message=f"Client {client_serial} updated successfully",
        data=ResponseManager.get_data(update_res),
    )


@user_bp.route("/get_office_clients", methods=["GET"])
def get_office_clients():
    """
    Return all clients for the current office with full basic details
    (for dropdown + table auto-fill).
    """
    office_serial = AuthorizationManager.get_office_serial()
    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")

    clients_res = mongodb_service.get_entity(
        entity=MongoDBEntity.CLIENTS,
        office_serial=office_serial,
        filters=None,
    )

    if not ResponseManager.is_success(clients_res):
        return ResponseManager.internal("Failed to fetch clients")

    clients = ResponseManager.get_data(clients_res)
    return ResponseManager.success(data=clients)


# ---------------- LOADERS ---------------- #


@user_bp.route("/load_birds_view_office")
def load_birds_view_office():
    return render_template("user_components/birds_view_office.html")


@user_bp.route("/load_office_details")
def load_office_details():
    return render_template("user_components/office_details.html")


@user_bp.route("/load_birds_view_user")
def load_birds_view_user():
    return render_template("user_components/birds_view_user.html")


@user_bp.route("/load_personal_details")
def load_personal_details():
    return render_template("user_components/personal_details.html")


@user_bp.route("/load_security_mfa")
@AuthorizationManager.login_required
def load_security_mfa():
    return render_template("user_components/security_mfa.html")


@user_bp.route("/load_birds_view_cases")
def load_birds_view_cases():
    return render_template("user_components/birds_view_cases.html")


@user_bp.route("/load_search_case")
def load_search_case():
    return render_template("user_components/search_case.html")


@user_bp.route("/load_new_case")
def load_new_case():
    return render_template("user_components/new_case.html")


@user_bp.route("/load_view_case")
def load_view_case():
    return render_template("user_components/view_case.html")


@user_bp.route("/load_birds_view_clients")
def load_birds_view_clients():
    return render_template("user_components/birds_view_clients.html")


@user_bp.route("/load_search_client")
def load_search_client():
    return render_template("user_components/search_client.html")


@user_bp.route("/load_new_client")
def load_new_client():
    return render_template("user_components/new_client.html")


@user_bp.route("/load_view_client")
def load_view_client():
    return render_template("user_components/view_client.html")


@user_bp.route("/load_search_file")
def load_search_file():
    return render_template("user_components/search_file.html")


@user_bp.route("/load_birds_view_attendance")
def load_birds_view_attendance():
    return render_template("user_components/birds_view_attendance.html")


@user_bp.route("/load_clock_in_out")
def load_clock_in_out():
    return render_template("user_components/clock_in_out.html")


@user_bp.route("/load_contact")
def load_contact():
    return render_template("user_components/contact.html")


@user_bp.route("/load_faq")
def load_faq():
    return render_template("user_components/faq.html")


@user_bp.route("/load_remote_control")
def load_remote_control():
    return render_template("user_components/remote_control.html")


@user_bp.route("/load_statement")
def load_statement():
    return render_template("user_components/statement.html")


@user_bp.route("/load_accessibility_statement")
def load_accessibility_statement():
    return render_template("user_components/accessibility_statement.html")


#   --- helpers


@user_bp.route("/get_document_types")
def get_document_types():
    try:
        return JSONManager.jsonify("document_types.json")
    except Exception as e:
        current_app.logger.error(f"❌ get_document_types error: {e}")
        return ResponseManager.error("Failed to load document types")


@user_bp.route("/get_case_categories")
def get_case_categories():
    try:
        return JSONManager.jsonify("case_categories.json")
    except Exception as e:
        current_app.logger.error(f"❌ get_case_categories error: {e}")
        return ResponseManager.error("Failed to load case categories")


@user_bp.route("/get_case_statuses")
def get_case_statuses():
    try:
        return JSONManager.jsonify("case_statuses.json")
    except Exception as e:
        current_app.logger.error(f"❌ get_case_statuses error: {e}")
        return ResponseManager.error("Failed to load case statuses")


# ---------------- MFA (TOTP) ---------------- #


@user_bp.route("/user/mfa/enroll", methods=["POST"])
@AuthorizationManager.login_required
def user_mfa_enroll():
    office_serial = AuthorizationManager.get_office_serial()
    user_serial = AuthorizationManager.get_user_serial()
    username = AuthorizationManager.get_username() or f"user-{user_serial}"
    if not office_serial or not user_serial:
        return ResponseManager.error("Missing auth context")

    # אם כבר מופעל – נחזיר שגיאה (אפשר לשנות למדיניות אחרת)
    user_res = mongodb_service.get_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(user_serial)),
        limit=1,
    )
    if not ResponseManager.is_success(user_res):
        return user_res
    docs = ResponseManager.get_data(user_res) or []
    user_doc = (docs[0] or {}).get("users", {}) if docs else {}
    if (user_doc.get("mfa") or {}).get("status") == "enabled":
        return ResponseManager.bad_request(
            "MFA already enabled. Reset first to re-enroll."
        )

    # יצירת הרשמה חדשה
    secret, otpauth_uri, qr_data_uri = MFAManager.start_enrollment(
        account_name=username
    )
    pending_doc = {
        "mfa": {
            "status": "pending",
            "method": "totp",
            "secret": secret,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    }
    up_res = mongodb_service.update_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(user_serial)),
        update_data=pending_doc,
        multiple=False,
        operator="$set",
    )
    if not ResponseManager.is_success(up_res):
        return up_res

    return ResponseManager.success(
        data={
            "secret": secret,
            "otpauth_uri": otpauth_uri,
            "qr_image": qr_data_uri,
        }
    )


@user_bp.route("/user/mfa/verify-enroll", methods=["POST"])
@AuthorizationManager.login_required
def user_mfa_verify_enroll():
    payload = request.get_json(silent=True) or {}
    code = (payload.get("code") or "").strip()

    office_serial = AuthorizationManager.get_office_serial()
    user_serial = AuthorizationManager.get_user_serial()
    if not office_serial or not user_serial:
        return ResponseManager.error("Missing auth context")
    if not (code.isdigit() and len(code) == 6):
        return ResponseManager.bad_request("Invalid code format")

    # שליפת secret מ-mfa.pending
    user_res = mongodb_service.get_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(user_serial)),
        limit=1,
    )
    if not ResponseManager.is_success(user_res):
        return user_res
    docs = ResponseManager.get_data(user_res) or []
    user_doc = (docs[0] or {}).get("users", {}) if docs else {}
    mfa = user_doc.get("mfa") or {}
    if mfa.get("status") != "pending" or not mfa.get("secret"):
        return ResponseManager.bad_request("No pending MFA enrollment")

    # אימות TOTP
    verify_res = MFAManager.verify_and_enable(
        office_serial, user_serial, mfa["secret"], code
    )
    if not ResponseManager.is_success(verify_res):
        return verify_res

    # עדכון סטטוס ל-enabled ושמירת enabled_at
    final_res = mongodb_service.update_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(user_serial)),
        update_data={
            "mfa": {
                "status": "enabled",
                "method": "totp",
                "secret": mfa["secret"],
                "created_at": mfa.get("created_at"),
                "enabled_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        multiple=False,
        operator="$set",
    )
    if not ResponseManager.is_success(final_res):
        return final_res

    return ResponseManager.success(message="MFA enabled")


@user_bp.route("/user/mfa/reset", methods=["POST"])
@AuthorizationManager.login_required
def user_mfa_reset():
    """
    איפוס מלא של MFA: מחזיר את שדה users.mfa ל-None.
    כרגע נדרש שדה 'password' בבקשה (אימות מינימלי כפי שסוכם).
    """
    payload = request.get_json(silent=True) or {}
    password = (payload.get("password") or "").strip()
    if not password:
        return ResponseManager.bad_request("Password confirmation is required")

    office_serial = AuthorizationManager.get_office_serial()
    user_serial = AuthorizationManager.get_user_serial()
    if not office_serial or not user_serial:
        return ResponseManager.error("Missing auth context")

    # 1) Fetch user to validate password

    user_res = mongodb_service.get_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(user_serial)),
        limit=1,
    )
    if not ResponseManager.is_success(user_res):
        return user_res

    docs = ResponseManager.get_data(user_res) or []
    user_doc = (docs[0] or {}).get("users", {}) if docs else {}

    password_hash = user_doc.get("password_hash")
    if not password_hash:
        return ResponseManager.error("Missing password hash")

    # 2) Verify password (use the SAME verifier you use in your auth layer)
    if not check_password_hash(password_hash, password):
        return ResponseManager.unauthorized("Invalid password")

    # מאפס לחלוטין את שדה ה-mfa (ללא session, ללא mfa_pending)
    res = MFAManager.reset_user_mfa(office_serial, user_serial)
    if not ResponseManager.is_success(res):
        return res

    return ResponseManager.success(message="MFA reset")


@user_bp.route("/user/mfa/status", methods=["GET"])
@AuthorizationManager.login_required
def user_mfa_status():
    office_serial = AuthorizationManager.get_office_serial()
    user_serial = AuthorizationManager.get_user_serial()
    if not office_serial or not user_serial:
        return ResponseManager.error("Missing auth context")

    user_res = mongodb_service.get_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(user_serial)),
        limit=1,
    )
    if not ResponseManager.is_success(user_res):
        return user_res
    docs = ResponseManager.get_data(user_res) or []
    user_doc = (docs[0] or {}).get("users", {}) if docs else {}
    return ResponseManager.success(data={"mfa": user_doc.get("mfa")})

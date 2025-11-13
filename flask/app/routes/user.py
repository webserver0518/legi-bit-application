# app/routes/user.py
from flask import Blueprint, render_template, request, flash, current_app

from ..services import mongodb_service, s3_service
from ..managers.response_management import ResponseManager
from ..managers.json_management import JSONManager
from ..managers.auth_management import AuthorizationManager
from ..constants.constants_mongodb import MongoDBEntity, MongoDBFilters, MongoDBData

user_bp = Blueprint('user', __name__)


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
        filename=file_name,
        filetype=file_type,
        filesize=file_size,
        key=key
    )

    return s3_res

# ---------------- BASE DASHBOARD ---------------- #

@user_bp.route('/base_user_dashboard')
@AuthorizationManager.login_required
def base_user_dashboard():
    return render_template("base_user_dashboard.html",
                           username=AuthorizationManager.get_username())


# ---------------- Office MANAGEMENT ---------------- #

@user_bp.route("/get_office_name")
def get_office_name():
    """ Return the current logged-in office name from auth """
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
    """ Return the current logged-in office name from auth """
    user_full_name = AuthorizationManager.get_username()
    if not user_full_name:
        current_app.logger.debug("No user full name found")
        return "Not Found"
    else:
        return user_full_name



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
        "name": data.get("file_name"),
        "type": data.get("file_type"),
        "status": "pending"
    }

    new_file_res = mongodb_service.create_entity(
        entity=MongoDBEntity.FILES,
        office_serial=office_serial,
        document=new_file_doc
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
        update_data=update_data
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
    key = f"uploads/{office_serial}/{case_serial}/{file_serial}-{file_name}"
    current_app.logger.debug(f"🔑 [get_file_url] Generated key: {key}")

    # 🧠 Request presigned URL from S3 service
    s3_res = s3_service.generate_presigned_get(key)
    if not ResponseManager.is_success(response=s3_res):
        current_app.logger.error(f"❌ [get_file_url] S3 service error: {s3_res['error']}")
        return s3_res

    presigned_url = ResponseManager.get_data(response=s3_res)
    current_app.logger.debug(f"✅ [get_file_url] Returning presigned URL for key: {key}")
    return ResponseManager.success(data=presigned_url)


# --------------------------------------------------------
# DELETE FILE
# --------------------------------------------------------
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
    key = f"uploads/{office_serial}/{case_serial}/{file_serial}-{file_name}"
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
        filters=MongoDBFilters.by_serial(file_serial)
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
        update_data={"files_serials": file_serial}
    )

    if not ResponseManager.is_success(case_update_res):
        current_app.logger.error(
            f"❌ [delete_file] Failed to pull file_serial={file_serial} from case={case_serial}"
        )

    current_app.logger.info(
        f"🟢 [delete_file] File serial={file_serial} deleted successfully"
    )
    return ResponseManager.success(message="File deleted")



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
    current_app.logger.debug(f"🟦 [get_case] Fetching case={case_serial} expand={expand}")

    case_res = mongodb_service.get_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(case_serial),
        limit=1,
        expand=expand
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

    # --- Simple filters ---
    if field:
        filters["field"] = {"$regex": field, "$options": "i"}
        current_app.logger.debug(f"📘 Added field filter: {filters['field']}")
    if status:
        filters["status"] = status
        current_app.logger.debug(f"⚙️ Added status filter: {status}")

    # --- Title tokens (each token must appear in title) ---
    if title_tokens:
        filters.setdefault("$and", [])
        for token in title_tokens:
            filters["$and"].append({"title": {"$regex": token, "$options": "i"}})
        current_app.logger.debug(f"🧩 Added title tokens filter: {filters['$and']}")

    # --- Client tokens (search via CLIENTS collection) ---
    if client_tokens:
        client_filter = {"$and": []}
        for token in client_tokens:
            client_filter["$and"].append({
                "$or": [
                    {"first_name": {"$regex": token, "$options": "i"}},
                    {"last_name": {"$regex": token, "$options": "i"}},
                ]
            })

        current_app.logger.debug(f"👤 Searching clients with filters: {client_filter}")

        clients_res = mongodb_service.get_entity(
            entity=MongoDBEntity.CLIENTS,
            office_serial=office_serial,
            filters=client_filter
        )

        if not ResponseManager.is_success(clients_res):
            current_app.logger.error("❌ Client search failed")
            return ResponseManager.success(data=[])

        clients = ResponseManager.get_data(clients_res)
        client_serials = [c["clients"]["serial"] for c in clients]
        current_app.logger.debug(f"👤 Found {len(client_serials)} matching clients: {client_serials}")

        if not client_serials:
            current_app.logger.debug("⚠️ No clients matched → returning []")
            return ResponseManager.success(data=[])

        # ✅ שינוי חשוב: תואם למבנה החדש של clients_serials
        filters["$or"] = [
            {f"clients_serials.{serial}": {"$exists": True}}
            for serial in client_serials
        ]
        current_app.logger.debug(f"🔗 Added clients_serials filter: {filters['$or']}")

    current_app.logger.debug(f"🧱 Final Mongo filters: {filters if filters else 'None'}")

    # --- Fetch cases ---
    cases_res = mongodb_service.get_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=filters or None,
        expand=expand
    )

    if ResponseManager.is_not_found(cases_res):
        current_app.logger.debug("⚠️ No cases found, returning empty list")
        return ResponseManager.success(data=[])

    if not ResponseManager.is_success(cases_res):
        current_app.logger.error("❌ Error fetching cases from MongoDB service")
        return cases_res

    cases = ResponseManager.get_data(cases_res)
    current_app.logger.debug(f"✅ Returning {len(cases)} cases after applying filters")
    return ResponseManager.success(data=cases)




@user_bp.route("/create_new_case", methods=["POST"])
def create_new_case():
    current_app.logger.debug("inside create_new_case()")

    def construct_client_document(d: dict):
        return {
            "created_at": d.get("created_at"),
            "id_card_number": d.get("id_card_number"),
            "first_name": d.get("first_name"),
            "last_name": d.get("last_name"),
            "phone": d.get("phone"),
            "email": d.get("email"),
            "city": d.get("city"),
            "street": d.get("street"),
            "home_number": d.get("home_number"),
            "postal_code": d.get("postal_code"),
            "birth_date": d.get("birth_date"),
        }
    
    def construct_file_document(d: dict):
        return {
            "created_at": d.get("created_at"),
            "user_serial": d.get("user_serial"),
            "name": d.get("file_name"),
            "type": d.get("file_type")
        }

    def construct_case_document(d: dict):
        return {
            "created_at": d.get("created_at"),
            "status": "active",
            "title": d.get("title"),
            "field": d.get("field"),
            "facts": d.get("facts", ""),
            "against": d.get("against"),
            "against_type": d.get("against_type"),
            "files_serials": [],
        }

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
    clients = data.get("clients", [])
    if not isinstance(clients, list) or len(clients) == 0:
        current_app.logger.debug("returning bad_request: No clients provided")
        return ResponseManager.bad_request("At least one client is required")

    client_serials_map = {}  # { serial: role }

    for i, c in enumerate(clients, start=1):
        new_client_doc = construct_client_document(c)
        new_client_doc["user_serial"] = user_serial
        new_client_doc["created_at"] = data.get("created_at")

        current_app.logger.debug(f"[client {i}] new_client_doc: {new_client_doc}")

        # ✅ Require only minimal mandatory fields
        mandatory_fields = ("first_name",)
        missing_fields = [k for k in mandatory_fields if not new_client_doc.get(k, None)]
        if missing_fields:
            msg = f"Missing required fields for client {i}: {', '.join(missing_fields)}"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(msg)

        new_client_res = mongodb_service.create_entity(
            entity=MongoDBEntity.CLIENTS,
            office_serial=office_serial,
            document=new_client_doc,
        )

        if not ResponseManager.is_success(new_client_res):
            current_app.logger.debug(f"Failed to create client {i}")
            return ResponseManager.internal(f"Failed to create client {i}")

        new_client_serial = ResponseManager.get_data(new_client_res)
        client_serials_map[str(new_client_serial)] = c.get("role", "secondary")

    # ✅ Ensure at least one main client exists
    if "main" not in client_serials_map.values():
        current_app.logger.debug("returning bad_request: no main client found")
        return ResponseManager.bad_request("At least one main client is required")

    # === Create Case ===
    new_case_doc = construct_case_document(data)
    new_case_doc["user_serial"] = user_serial
    new_case_doc["clients_serials"] = client_serials_map

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
    current_app.logger.debug(f"Created new case with serial={new_case_serial} in office={office_serial}")
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
        filters=MongoDBFilters.by_serial(case_serial)
    )

    if not ResponseManager.is_success(response=delete_res):
        current_app.logger.error(f"DELETE /delete_case | failed to delete case {case_serial} in office {office_serial}")
        flash("failed to delete case", "danger")
        return delete_res

    current_app.logger.info(f"DELETE /delete_case | deleted case {case_serial} in office {office_serial}")
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

    current_app.logger.debug(f"PATCH /update_case | office={office_serial}, case={case_serial}, update={update_data}")

    # perform the update via MongoDB microservice
    update_res = mongodb_service.update_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(case_serial),
        update_data=update_data,
        multiple=False
    )

    if not ResponseManager.is_success(response=update_res):
        error = ResponseManager.get_error(response=update_res)
        current_app.logger.error(f"PATCH /update_case | failed to update case {case_serial}: {error}")
        return update_res

    current_app.logger.info(f"PATCH /update_case | case {case_serial} updated successfully")
    return ResponseManager.success(
        message=f"Case {case_serial} updated successfully",
        data=ResponseManager.get_data(update_res)
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
        return ResponseManager.bad_request(f"Invalid status '{new_status}'. Must be one of: open, closed, archived")

    current_app.logger.debug(
        f"PATCH /update_status | office={office_serial}, case={case_serial}, update={update_data}"
    )

    update_res = mongodb_service.update_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(case_serial),
        update_data=update_data,
        multiple=False
    )

    if not ResponseManager.is_success(update_res):
        return update_res

    return ResponseManager.success(
        message=f"Case {case_serial} status updated to '{new_status}'",
        data=ResponseManager.get_data(update_res)
    )

# ---------------- CLIENTS MANAGEMENT ---------------- #




# ---------------- LOADERS ---------------- #

@user_bp.route("/load_cases_birds_view")
def load_cases_birds_view():
    return render_template("user_components/cases_birds_view.html")

@user_bp.route("/load_cases")
def load_cases():
    return render_template("user_components/cases.html")

@user_bp.route("/load_add_case")
def load_add_case():
    return render_template("user_components/add_case.html")

@user_bp.route("/load_view_case")
def load_view_case():
    return render_template("user_components/view_case.html")


@user_bp.route("/load_clients_birds_view")
def load_clients_birds_view():
    return render_template("user_components/clients_birds_view.html")

@user_bp.route("/load_clients")
def load_clients():
    return render_template("user_components/clients.html")

@user_bp.route("/load_add_client")
def load_add_client():
    return render_template("user_components/add_client.html")

@user_bp.route("/load_view_client")
def load_view_client():
    return render_template("user_components/view_client.html")


@user_bp.route("/load_attendance_birds_view")
def load_attendance_birds_view():
    return render_template("user_components/attendance_birds_view.html")

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
# app/routes/user.py
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, current_app

from ..services import mongodb_service, s3_service
from ..managers.response_management import ResponseManager
from ..managers.json_management import JSONManager
from ..managers.auth_management import AuthorizationManager
from ..constants.constants_mongodb import MongoDBEntity, MongoDBFilters

user_bp = Blueprint('user', __name__)


@user_bp.route("/auth_debug")
def auth_debug():
    """Show all current auth variables for debugging."""
    return AuthorizationManager.get()

# ---------------- HELPERS ---------------- #


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

    case = ResponseManager.get_data(response=case_res)
    case = case[0]  # limit = 1
    # debug success
    current_app.logger.debug(f"returning success with case")
    return ResponseManager.success(data=case)


@user_bp.route("/get_office_cases")
def get_office_cases():
    """Return only active cases."""
    office_serial = AuthorizationManager.get_office_serial()
    expand =        request.args.get("expand", False)

    if not office_serial:
        return ResponseManager.error("Missing office_serial in auth")

    cases_res = mongodb_service.get_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        expand=expand
    )

    if not ResponseManager.is_success(response=cases_res):
        flash(ResponseManager.get_error(response=cases_res), "danger")
        return cases_res

    cases = ResponseManager.get_data(response=cases_res)
    return ResponseManager.success(data=cases)


@user_bp.route("/get_office_active_cases")
def get_office_active_cases():
    """Return only active cases."""
    current_app.logger.debug("inside get_office_active_cases()")

    office_serial = AuthorizationManager.get_office_serial()
    expand = request.args.get("expand", False)
    if not office_serial:
        # debug bad request
        current_app.logger.debug(f"returning bad_request: 'office_serial' is required")
        return ResponseManager.error("Missing office_serial in auth")

    # debug func call
    current_app.logger.debug(f"calling create_entity() from get_office_active_cases()")
    cases_res = mongodb_service.get_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.Case.active,
        expand=expand
    )

    if not ResponseManager.is_success(response=cases_res):
        # debug internal error
        current_app.logger.debug(f"returning internal error: Failed to get cases")
        return ResponseManager.internal("Failed to get cases")

    cases = ResponseManager.get_data(response=cases_res)
    # debug success
    current_app.logger.debug(f"returning success with {len(cases)} cases")
    return ResponseManager.success(data=cases)


@user_bp.route("/get_office_archived_cases")
def get_office_archived_cases():
    """Return only archived cases."""
    current_app.logger.debug("inside get_office_archived_cases()")

    office_serial = AuthorizationManager.get_office_serial()
    expand = request.args.get("expand")
    if not office_serial:
        # debug bad request
        current_app.logger.debug(f"returning bad_request: 'office_serial' is required")
        return ResponseManager.bad_request("Missing 'office_serial' in auth")

    # debug func call
    current_app.logger.debug(f"calling create_entity() from get_office_archived_cases()")
    cases_res = mongodb_service.get_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        filters=MongoDBFilters.Case.archived,
        expand=expand
    )

    if not ResponseManager.is_not_found(response=cases_res):
        # debug not found
        current_app.logger.debug(f"returning not found")
        return ResponseManager.internal("Not Found")

    if not ResponseManager.is_success(response=cases_res):
        # debug internal error
        current_app.logger.debug(f"returning internal error: Failed to get cases")
        return ResponseManager.internal("Failed to get cases")

    cases = ResponseManager.get_data(response=cases_res)
    # debug success
    current_app.logger.debug(f"returning success with {len(cases)} cases")
    return ResponseManager.success(data=cases)



@user_bp.route("/create_new_case", methods=["POST"])
def create_new_case():
    current_app.logger.debug("inside create_new_case()")

    def construct_client_document(d: dict):
        return {
            "created_at": d.get("created_at"),
            "id_card_number": d.get("client_id_card_number"),
            "first_name": d.get("client_first_name"),
            "last_name": d.get("client_last_name"),
            "phone": d.get("client_phone"),
            "email": d.get("client_email"),
            "city": d.get("client_city"),
            "street": d.get("client_street"),
            "street_number": d.get("client_street_number"),
            "postal_code": d.get("client_postal_code")
        }

    def construct_case_document(d: dict):
        return {
            "created_at": d.get("created_at"),
            "status": "open",
            "title": d.get("title"),
            "category": d.get("category"),
            "facts": d.get("facts", ""),
            "files_serials": []
        }

    office_serial = AuthorizationManager.get_office_serial()
    user_serial = AuthorizationManager.get_user_serial()
    if not office_serial:
        # debug bad request
        current_app.logger.debug(f"returning bad_request: 'office_serial' is required")
        return ResponseManager.bad_request("Missing 'office_serial' in auth")
    if not user_serial:
        # debug bad request
        current_app.logger.debug(f"returning bad_request: 'user_serial' is required")
        return ResponseManager.bad_request("Missing 'user_serial' in auth")

    data = request.get_json(force=True)
    if not data:
        # debug bad request
        current_app.logger.debug("returning bad_request: Missing request JSON")
        return ResponseManager.bad_request("Missing request JSON")

    # Create new Client
    new_client_doc = construct_client_document(data)
    new_client_doc['user_serial'] = user_serial # attach user that created this client
    # debug new Client
    current_app.logger.debug(f"new_client_doc: {new_client_doc}")

    for k, v in new_client_doc.items():
        if not v:
            # debug bad request
            current_app.logger.debug(f"returning bad_request: Missing Client's '{k}' attribute")
            return ResponseManager.bad_request(f"Missing Client's '{k}' attribute")

    # debug func call
    current_app.logger.debug(f"calling create_entity() from create_new_case()")
    new_client_res = mongodb_service.create_entity(
        entity=MongoDBEntity.CLIENTS,
        office_serial=office_serial,
        document=new_client_doc
    )
    if not ResponseManager.is_success(response=new_client_res):
        # debug internal error
        current_app.logger.debug(f"returning internal error: Failed to create client")
        return ResponseManager.internal("Failed to create client")

    new_client_serial = ResponseManager.get_data(response=new_client_res)

    # Create new case
    new_case_doc = construct_case_document(data)
    new_case_doc['user_serial'] = user_serial
    new_case_doc['client_serial'] =  new_client_serial
    # debug new Case
    current_app.logger.debug(f"new_case_doc: {new_case_doc}")

    for k, v in new_case_doc.items():
        if not v and k != "files_serials": # todo: delete k != "files_serials"
            # debug bad request
            current_app.logger.debug(f"returning bad_request: Missing case '{k}' attribute")
            return ResponseManager.bad_request(f"Missing case '{k}' attribute")

    # debug func call
    current_app.logger.debug(f"calling create_entity() from create_new_case()")
    new_case_res = mongodb_service.create_entity(
        entity=MongoDBEntity.CASES,
        office_serial=office_serial,
        document=new_case_doc
    )
    if not ResponseManager.is_success(response=new_case_res):
        # debug internal error
        current_app.logger.debug(f"returning internal error: Failed to create client")
        return ResponseManager.internal("Failed to create client")

    new_case_serial = ResponseManager.get_data(response=new_case_res)

    # debug success
    current_app.logger.debug(f"Created new case with serial={new_case_serial} in office={office_serial}")
    current_app.logger.debug(f"returning success with serial={new_case_serial}")
    return ResponseManager.success(data=new_case_serial)

@user_bp.route("/delete_case", methods=["DELETE"])
def delete_case():
    office_serial = AuthorizationManager.get_office_serial()
    case_serial = request.args.get("serial")

    if not office_serial:
        return ResponseManager.error("Missing 'office_serial' in auth")
    if not case_serial:
        return ResponseManager.bad_request("Missing 'case_serial'")

    try:
        case_serial = int(case_serial)
    except ValueError:
        return ResponseManager.bad_request("Invalid 'case_serial' format")

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


# ---------------- CLIENTS MANAGEMENT ---------------- #




# ---------------- LOADERS ---------------- #

@user_bp.route("/load_cases_birds_view")
def load_cases_birds_view():
    return render_template("user_components/cases_birds_view.html")

@user_bp.route("/load_active_cases")
def load_active_cases():
    return render_template("user_components/active_cases.html")

@user_bp.route("/load_add_case")
def load_add_case():
    return render_template("user_components/add_case.html")

@user_bp.route("/load_view_case")
def load_view_case():
    return render_template("user_components/view_case.html")

@user_bp.route("/load_archived_cases")
def load_archived_cases():
    return render_template("user_components/archived_cases.html")


@user_bp.route("/load_clients_birds_view")
def load_clients_birds_view():
    return render_template("user_components/clients_birds_view.html")

@user_bp.route("/load_active_clients")
def load_active_clients():
    return render_template("user_components/active_clients.html")

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
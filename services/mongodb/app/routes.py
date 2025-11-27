# app/routes.py
from flask import jsonify, request, Blueprint

from .managers.mongodb_management import MongoDBManager
from .managers.response_management import ResponseManager


bp = Blueprint("main", __name__)


# ---------------------- Core ----------------------


@bp.route("/healthz", methods=["GET"])
def healthz():
    return jsonify({"status": "ok"}), 200


# ---------------------- Index Management ----------------------


@bp.route("/ensure_indexes", methods=["POST"])
def ensure_indexes():
    data = request.get_json(force=True)
    db_name = data.get("db_name")

    if not db_name:
        return ResponseManager.bad_request("Missing 'db_name'")

    return MongoDBManager.ensure_indexes(db_name)


# ---------------------- Entity Helpers ----------------------


@bp.route("/get_entity", methods=["POST"])
def get_entity():
    data = request.get_json(force=True)

    entity = data.get("entity")
    office_serial = data.get("office_serial")
    filters = data.get("filters")
    projection = data.get("projection")
    sort = data.get("sort")
    limit = data.get("limit", 0)
    expand = data.get("expand", False)

    return MongoDBManager.get_entity(
        entity=entity,
        office_serial=office_serial,
        filters=filters,
        projection=projection,
        sort=tuple(sort) if sort else None,
        limit=int(limit) if limit else 0,
        expand=bool(expand),
    )


@bp.route("/create_entity", methods=["POST"])
def create_entity():
    data = request.get_json(force=True)

    entity = data.get("entity")
    office_serial = data.get("office_serial")
    document = data.get("document")

    return MongoDBManager.create_entity(
        entity=entity, office_serial=office_serial, document=document
    )


@bp.route("/delete_entity", methods=["DELETE"])
def delete_entity():
    data = request.get_json(force=True)

    entity = data.get("entity")
    office_serial = data.get("office_serial")
    filters = data.get("filters")

    return MongoDBManager.delete_entity(
        entity=entity, office_serial=office_serial, filters=filters
    )


@bp.route("/update_entity", methods=["PATCH"])
def update_entity():
    data = request.get_json(force=True)

    entity = data.get("entity")
    office_serial = data.get("office_serial")
    filters = data.get("filters")
    update_data = data.get("update_data")
    multiple = data.get("multiple", False)
    operator = data.get("operator", "$set")

    return MongoDBManager.update_entity(
        entity=entity,
        office_serial=office_serial,
        filters=filters,
        update_data=update_data,
        multiple=multiple,
        operator=operator,
    )


# ---------------------- Counters ----------------------


# ---------- Tenant ----------
@bp.route("/get_user_counter", methods=["GET"])
def get_user_counter():
    db_name = request.args.get("db_name")
    return MongoDBManager.get_user_counter(db_name=db_name)


@bp.route("/get_case_counter", methods=["GET"])
def get_case_counter():
    db_name = request.args.get("db_name")
    return MongoDBManager.get_case_counter(db_name=db_name)


@bp.route("/get_client_counter", methods=["GET"])
def get_client_counter():
    db_name = request.args.get("db_name")
    return MongoDBManager.get_client_counter(db_name=db_name)


@bp.route("/get_file_counter", methods=["GET"])
def get_file_counter():
    db_name = request.args.get("db_name")
    return MongoDBManager.get_file_counter(db_name=db_name)


# ---------- Global ----------
@bp.route("/get_offices_counter", methods=["GET"])
def get_offices_counter():
    return MongoDBManager.get_offices_counter()


# ---------------------- Helpers ----------------------


# ---------- Tenant ----------
@bp.route("/get_office_serial", methods=["GET"])
def get_office_serial():
    office_name = request.args.get("office_name")
    return MongoDBManager.get_office_serial(office_name=office_name)


@bp.route("/get_office_name", methods=["GET"])
def get_office_name():
    office_serial = request.args.get("office_serial")
    return MongoDBManager.get_office_name(office_serial=int(office_serial))


@bp.route("/get_offices", methods=["GET"])
def get_offices():
    return MongoDBManager.get_offices()


@bp.route("/create_new_office", methods=["POST"])
def create_new_office():
    data = request.get_json(force=True) or {}
    office_name = data.get("office_name")
    return MongoDBManager.create_new_office(office_name=office_name)


# ---------------------- Login ----------------------


# ---------- Admin ----------


@bp.route("/get_admin_passwords_hashes", methods=["GET"])
def get_admin_passwords_hashes():
    return MongoDBManager.get_admin_passwords_hashes()


@bp.route("/admin_login", methods=["POST"])
def admin_login():
    data = request.get_json(force=True)
    password = data.get("password")
    return MongoDBManager.admin_login(password=password)

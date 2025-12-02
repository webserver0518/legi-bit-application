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
    data = request.get_json(silent=True) or {}

    db_name = data.get("db_name")

    return MongoDBManager.ensure_indexes(db_name)


# ---------------------- Entity Helpers ----------------------


@bp.route("/entities/search", methods=["POST"])
def search_entities():
    data = request.get_json(silent=True) or {}

    entity = data.get("entity")
    office_serial = data.get("office_serial")
    filters = data.get("filters")
    projection = data.get("projection")
    sort = data.get("sort")
    limit = data.get("limit", 0)
    expand = data.get("expand", False)

    return MongoDBManager.search_entities(
        entity=entity,
        office_serial=office_serial,
        filters=filters,
        projection=projection,
        sort=tuple(sort) if sort else None,
        limit=int(limit) if limit else 0,
        expand=bool(expand),
    )


@bp.route("/entities", methods=["POST"])
def create_entity():
    data = request.get_json(silent=True) or {}

    entity = data.get("entity")
    office_serial = data.get("office_serial")
    document = data.get("document")

    return MongoDBManager.create_entity(
        entity=entity, office_serial=office_serial, document=document
    )


@bp.route("/entities/delete", methods=["DELETE"])
def delete_entities():
    data = request.get_json(silent=True) or {}

    entity = data.get("entity")
    office_serial = data.get("office_serial")
    filters = data.get("filters")

    return MongoDBManager.delete_entities(
        entity=entity, office_serial=office_serial, filters=filters
    )


@bp.route("/entities/update", methods=["PATCH"])
def update_entities():
    data = request.get_json(silent=True) or {}

    entity = data.get("entity")
    office_serial = data.get("office_serial")
    filters = data.get("filters")
    update_data = data.get("update_data")
    multiple = data.get("multiple", False)
    operator = data.get("operator", "$set")

    return MongoDBManager.update_entities(
        entity=entity,
        office_serial=office_serial,
        filters=filters,
        update_data=update_data,
        multiple=multiple,
        operator=operator,
    )


# ---------------------- Counters ----------------------


# ---------- Tenant ----------
@bp.route("/counters/users", methods=["GET"])
def get_user_counter():
    db_name = request.args.get("db_name")
    return MongoDBManager.get_user_counter(db_name=db_name)


@bp.route("/counters/cases", methods=["GET"])
def get_case_counter():
    db_name = request.args.get("db_name")
    return MongoDBManager.get_case_counter(db_name=db_name)


@bp.route("/counters/clients", methods=["GET"])
def get_client_counter():
    db_name = request.args.get("db_name")
    return MongoDBManager.get_client_counter(db_name=db_name)


@bp.route("/counters/files", methods=["GET"])
def get_file_counter():
    db_name = request.args.get("db_name")
    return MongoDBManager.get_file_counter(db_name=db_name)


# ---------- Global ----------
@bp.route("/counters/offices", methods=["GET"])
def get_offices_counter():
    return MongoDBManager.get_offices_counter()


# ---------------------- Helpers ----------------------


# ---------- Tenant ----------

@bp.route("/offices/search", methods=["POST"])
def search_offices():
    data = request.get_json(silent=True) or {}

    filters = data.get("filters")
    projection = data.get("projection")
    sort = data.get("sort")
    limit = data.get("limit", 0)

    return MongoDBManager.search_offices(
        filters=filters,
        projection=projection,
        sort=tuple(sort) if sort else None,
        limit=int(limit) if limit else 0
    )


@bp.route("/offices", methods=["POST"])
def create_office():
    data = request.get_json(silent=True) or {}

    name = data.get("name")

    return MongoDBManager.create_office(name=name)


@bp.route("/offices/<serial>", methods=["DELETE"])
def delete_office(serial):
    return MongoDBManager.delete_office(serial=serial)


# ---------------------- Login ----------------------


# ---------- Admin ----------


@bp.route("/admin/passwords", methods=["GET"])
def get_admin_passwords():
    return MongoDBManager.get_admin_passwords()


@bp.route("/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}

    password = data.get("password")

    return MongoDBManager.admin_login(password=password)

# s3_app.py
from flask import jsonify, request, Blueprint

from .managers.s3_management import S3Manager
from .managers.response_management import ResponseManager


bp = Blueprint('main', __name__)


# ---------- Core ----------

@bp.route("/healthz", methods=["GET"])
def healthz():
    """Simple health check."""
    return jsonify({"status": "ok"}), 200


@bp.route("/list_keys", methods=["GET"])
def list_keys():
    """List all S3 keys (optionally under a prefix)."""
    prefix = request.args.get("prefix", "")
    mode = request.args.get("mode", "yield")
    try:
        if mode == "log":
            S3Manager.all_keys(mode="log", prefix=prefix)
            return ResponseManager.success(data="Keys logged")
        else:
            keys = list(S3Manager.all_keys(mode="yield", prefix=prefix))
            return ResponseManager.success(data=keys)
    except Exception as e:
        return ResponseManager.internal(error=str(e))


@bp.route("/generate_post", methods=["POST"])
def generate_post():
    """
    Generate a presigned POST URL.
    Expects JSON: { "file_name": "file.pdf", "file_type": "application/pdf", "file_size": 12345, "key": "office/file.pdf" }
    """
    data = request.get_json()
    try:
        file_name = data["file_name"]
        file_type = data["file_type"]
        file_size = int(data["file_size"])
        key = data["key"]
        result = S3Manager.generate_presigned_post(file_name, file_type, file_size, key)
        return ResponseManager.success(data=result)
    except Exception as e:
        return ResponseManager.internal(error=str(e))


@bp.route("/generate_get", methods=["GET"])
def generate_get():
    """Generate a presigned GET (download) URL for a file key."""
    key = request.args.get("key")
    if not key:
        return ResponseManager.bad_request(error="Missing 'key' parameter")
    result = S3Manager.generate_presigned_get(key)
    return ResponseManager.success(data=result)


@bp.route("/delete", methods=["DELETE"])
def delete_object():
    """Delete an object from S3 by key."""
    data = request.get_json()
    key = data.get("key")
    if not key:
        return ResponseManager.bad_request(error="Missing key")
    result = S3Manager.delete(key)
    return ResponseManager.success(data=result)

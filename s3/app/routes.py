# app/routes.py
from flask import jsonify, request, Blueprint

from .managers.s3_management import S3Manager
from .managers.response_management import ResponseManager


bp = Blueprint('main', __name__)


# ---------------------- Core ----------------------
@bp.route("/healthz", methods=["GET"])
def healthz():
    return jsonify({"status": "ok"}), 200


# ------------------------ List Keys -------------------------
@bp.route("/list_keys", methods=["GET"])
def list_keys():
    """List all S3 keys (optionally under a prefix)."""
    prefix = request.args.get("prefix", "")
    return S3Manager.all_keys(prefix=prefix)


# ------------------------ Generate Presigned POST -------------------------
@bp.route("/presign/post", methods=["POST"])
def generate_post():
    """
    Generate a presigned POST URL.
    Expects JSON: { "file_name": "file.pdf", "file_type": "application/pdf", "file_size": 12345, "key": "office/file.pdf" }
    """
    data = request.get_json()
    file_name = data.get("file_name")
    file_type = data.get("file_type")
    file_size = data.get("file_size")
    key = data.get("key")
    
    return S3Manager.generate_presigned_post(
        file_name=file_name,
        file_type=file_type,
        file_size=file_size,
        key=key
    )


# ------------------------ Generate Presigned GET -------------------------
@bp.route("/presign/get", methods=["GET"])
def generate_get():
    """Generate a presigned GET (download) URL for a file key."""
    key = request.args.get("key")
    
    return S3Manager.generate_presigned_get(key=key)

# ------------------------ Upload -------------------------
@bp.route("/create", methods=["POST"])
def create():
    """Upload a file object to S3."""
    file_obj = request.files.get("file")
    key = request.form.get("key")
    
    return S3Manager.create(
        file_obj=file_obj, 
        key=key
    )


# ------------------------ Delete -------------------------
@bp.route("/delete", methods=["DELETE"])
def delete():
    """Delete an object from S3 by key."""
    data = request.get_json()
    key = data.get("key")
    
    return S3Manager.delete(key=key)

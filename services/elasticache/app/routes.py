from flask import jsonify, request, Blueprint

from .managers.redis_management import RedisManager
from .managers.response_management import ResponseManager


bp = Blueprint('main', __name__)


# ---------------------- Core ----------------------

@bp.route("/healthz", methods=["GET"])
def healthz():
    """Health check endpoint."""
    return jsonify({"status": "ok"}), 200


# ---------------------- Redis Basic Operations ----------------------

@bp.route("/get_value", methods=["GET"])
def get_value():
    """
    Retrieve a value from Redis by key.
    Example: GET /get_value?key=myKey
    """
    key = request.args.get("key")
    return RedisManager.get_value(key=key)


@bp.route("/set_value", methods=["POST"])
def set_value():
    """
    Set a key-value pair in Redis.
    Example body:
    {
        "key": "username",
        "value": {"name": "Matan"},
        "ttl": 300
    }
    """
    data = request.get_json(force=True)
    key = data.get("key")
    value = data.get("value")
    ttl = data.get("ttl", 300)
    return RedisManager.set_value(key=key, value=value, ttl=ttl)


@bp.route("/delete_key", methods=["DELETE"])
def delete_key():
    """
    Delete a key from Redis.
    Example: DELETE /delete_key?key=myKey
    """
    key = request.args.get("key")
    return RedisManager.delete_key(key=key)


@bp.route("/flush_all", methods=["POST"])
def flush_all():
    """
    Delete all keys from the current Redis database.
    Use with caution.
    """
    return RedisManager.flush_all()


# ---------------------- Ping / Connectivity ----------------------

@bp.route("/ping", methods=["GET"])
def ping():
    """
    Check Redis connection health.
    Example: GET /ping
    """
    try:
        client = RedisManager._get_client()
        pong = client.ping()
        return jsonify({"status": "ok", "pong": pong}), 200
    except Exception as e:
        return ResponseManager.internal_error(error=str(e))

# app/routes.py
from flask import Blueprint, request, jsonify

from .managers.response_management import ResponseManager
from .managers.ses_management import SESManager


bp = Blueprint("main", __name__)


# ---------------------- Core ----------------------


@bp.route("/healthz", methods=["GET"])
def healthz():
    return jsonify({"status": "ok"}), 200


# ---------------------- Message Management ----------------------


@bp.route("/send_email", methods=["POST"])
def send_email():
    data = request.json or {}
    to_email = data.get("to")
    subject = data.get("subject", "Legi-Bit Notification")
    message = data.get("message")

    if not to_email:
        return ResponseManager.bad_request(error="Missing destination email")

    if not message:
        return ResponseManager.bad_request(error="Missing email message")

    SESManager.send_email(to_email=to_email, subject=subject, message=message)

    return ResponseManager.success()


@bp.route("/send_whatsapp", methods=["POST"])
def send_whatsapp():
    return ResponseManager.bad_request("WhatsApp support disabled")

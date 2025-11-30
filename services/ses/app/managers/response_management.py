# app/managers/response_management.py
from flask import jsonify, current_app
from http import HTTPStatus
import json


class ResponseManager:
    """Unified JSON responses across the app."""

    # ---------------------- CORE BUILDER ----------------------
    @staticmethod
    def _build(
        success: bool, status: HTTPStatus, message=None, error=None, data=None
    ) -> tuple[dict, HTTPStatus]:
        payload = {
            "success": success,
            "message": message,
            "error": error,
            "data": data,
            "status": status,
        }

        return jsonify(payload), status

    # ---------------------- PARSE RESPONSES ----------------------

    @staticmethod
    def validate(response: tuple) -> bool:
        """Return True if response is a valid ResponseManager tuple."""
        return (
            isinstance(response, tuple)
            and len(response) == 2
            and hasattr(response[0], "get_data")
        )

    @staticmethod
    def _parse(response: tuple):
        """
        Parse a Flask response tuple returned by ResponseManager (jsonify, status).

        Expected input:
            (jsonify_response, status_code)

        Returns:
            dict {
                "success": bool,
                "message": str | None,
                "error": str | None,
                "data": any | None,
                "status": int
            }
        """

        if not ResponseManager.validate(response):
            raise ValueError("Expected ResponseManager response format")

        resp, status = response
        try:
            payload = json.loads(resp.get_data(as_text=True))
        except Exception as e:
            raise ValueError(f"Invalid JSON in ResponseManager response: {e}")

        return {
            "success": payload.get("success", False),
            "message": payload.get("message"),
            "error": payload.get("error"),
            "data": payload.get("data"),
            "status": status,
        }

    # ---------------------- GETTERS ----------------------

    @staticmethod
    def get_success(response: tuple) -> bool:
        return ResponseManager._parse(response).get("success", False)

    @staticmethod
    def get_message(response: tuple):
        return ResponseManager._parse(response).get("message")

    @staticmethod
    def get_error(response: tuple):
        return ResponseManager._parse(response).get("error")

    @staticmethod
    def get_data(response: tuple):
        return ResponseManager._parse(response).get("data")

    @staticmethod
    def get_status(response: tuple) -> int:
        return ResponseManager._parse(response).get("status")

    # ---------------------- STATUS HELPERS ----------------------

    @staticmethod
    def is_success(response: tuple) -> bool:
        return ResponseManager.get_success(response) is True

    @staticmethod
    def is_created(response: tuple) -> bool:
        return ResponseManager.get_status(response) == HTTPStatus.CREATED

    @staticmethod
    def is_no_content(response: tuple) -> bool:
        return ResponseManager.get_status(response) == HTTPStatus.NO_CONTENT

    @staticmethod
    def is_error(response: tuple) -> bool:
        return ResponseManager.get_success(response) is False

    @staticmethod
    def is_bad_request(response: tuple) -> bool:
        return ResponseManager.get_status(response) == HTTPStatus.BAD_REQUEST

    @staticmethod
    def is_unauthorized(response: tuple) -> bool:
        return ResponseManager.get_status(response) == HTTPStatus.UNAUTHORIZED

    @staticmethod
    def is_forbidden(response: tuple) -> bool:
        return ResponseManager.get_status(response) == HTTPStatus.FORBIDDEN

    @staticmethod
    def is_not_found(response: tuple) -> bool:
        return ResponseManager.get_status(response) == HTTPStatus.NOT_FOUND

    @staticmethod
    def is_conflict(response: tuple) -> bool:
        return ResponseManager.get_status(response) == HTTPStatus.CONFLICT

    @staticmethod
    def is_internal(response: tuple) -> bool:
        return ResponseManager.get_status(response) == HTTPStatus.INTERNAL_SERVER_ERROR

    # ---------------------- SUCCESS RESPONSES ----------------------

    @staticmethod
    def success(data=None, message="OK", status: HTTPStatus = HTTPStatus.OK):
        """Return a standardized success JSON response."""
        return ResponseManager._build(
            success=True, status=status, message=message, data=data
        )

    @staticmethod
    def created(data=None, message="Created"):
        """Return a standardized 201 Created response."""
        return ResponseManager.success(
            status=HTTPStatus.CREATED, message=message, data=data
        )

    @staticmethod
    def no_content(message="No content"):
        """Return a standardized 204 No Content response."""
        return ResponseManager.success(
            status=HTTPStatus.NO_CONTENT, message=message, data=None
        )

    # ---------------------- ERROR RESPONSES ----------------------
    @staticmethod
    def error(error="Error", message=None, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        """Return a standardized error JSON response."""
        return ResponseManager._build(
            success=False, status=status, message=message, error=error, data=None
        )

    @staticmethod
    def bad_request(error="Invalid request", message=None):
        return ResponseManager.error(
            error=error, message=message, status=HTTPStatus.BAD_REQUEST
        )

    @staticmethod
    def unauthorized(error="Unauthorized", message=None):
        return ResponseManager.error(
            error=error, message=message, status=HTTPStatus.UNAUTHORIZED
        )

    @staticmethod
    def forbidden(error="Forbidden", message=None):
        return ResponseManager.error(
            error=error, message=message, status=HTTPStatus.FORBIDDEN
        )

    @staticmethod
    def not_found(error="Not found", message=None):
        return ResponseManager.error(
            error=error, message=message, status=HTTPStatus.NOT_FOUND
        )

    @staticmethod
    def conflict(error="Conflict", message=None):
        return ResponseManager.error(
            error=error, message=message, status=HTTPStatus.CONFLICT
        )

    @staticmethod
    def internal(error="Internal server error", message=None):
        return ResponseManager.error(
            error=error, message=message, status=HTTPStatus.INTERNAL_SERVER_ERROR
        )

    @staticmethod
    def bad_gateway(error="Bad Gateway", message=None):
        return ResponseManager.error(
            error=error, message=message, status=HTTPStatus.BAD_GATEWAY
        )

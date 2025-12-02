from __future__ import annotations

import base64
from io import BytesIO
from typing import Optional, Tuple

import pyotp
import qrcode

from ..services import mongodb_service
from ..managers.response_management import ResponseManager
from ..constants.constants_mongodb import MongoDBEntity, MongoDBFilters


class MFAManager:
    """
    לוגיקת TOTP (Google Authenticator):
      - יצירת secret + otpauth://
      - הפקת QR כ-data URI
      - אימות קוד
      - שמירה/איפוס בשדה יחיד 'mfa': { method: 'totp', secret: '<base32>' }
    """

    ISSUER_DEFAULT = "Legi-Bit"
    VALID_WINDOW = 1  # טולרנס של צעד זמן אחד

    # ---------- יצירה ואימות TOTP ---------- #

    @classmethod
    def generate_secret(cls) -> str:
        return pyotp.random_base32()

    @classmethod
    def build_otpauth_uri(
        cls, secret: str, account_name: str, issuer: Optional[str] = None
    ) -> str:
        issuer_name = issuer or cls.ISSUER_DEFAULT
        return pyotp.TOTP(secret).provisioning_uri(
            name=account_name, issuer_name=issuer_name
        )

    @classmethod
    def make_qr_data_uri(cls, text: str) -> str:
        img = qrcode.make(text)
        buf = BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/png;base64,{b64}"

    @classmethod
    def verify_totp(cls, secret: str, code: str) -> bool:
        if not (code and code.isdigit() and len(code) == 6):
            return False
        totp = pyotp.TOTP(secret)
        return bool(totp.verify(code, valid_window=cls.VALID_WINDOW))

    # ---------- התממשקות ל-DB (Mongo) ---------- #

    @classmethod
    def save_user_mfa(
        cls, office_serial: int, user_serial: int, secret: str, method: str = "totp"
    ):
        return mongodb_service.update_entities(
            entity=MongoDBEntity.USERS,
            office_serial=office_serial,
            filters=MongoDBFilters.by_serial(int(user_serial)),
            update_data={"mfa": {"method": method, "secret": secret}},
            multiple=False,
            operator="$set",
        )

    @classmethod
    def reset_user_mfa(cls, office_serial: int, user_serial: int):
        return mongodb_service.update_entities(
            entity=MongoDBEntity.USERS,
            office_serial=office_serial,
            filters=MongoDBFilters.by_serial(int(user_serial)),
            update_data={"mfa": None},
            multiple=False,
            operator="$set",
        )

    # ---------- תרחישי עזר לראוטים ---------- #

    @classmethod
    def start_enrollment(
        cls, account_name: str, issuer: Optional[str] = None
    ) -> Tuple[str, str, str]:
        """
        מחזיר: (secret, otpauth_uri, qr_data_uri)
        """
        secret = cls.generate_secret()
        uri = cls.build_otpauth_uri(secret, account_name, issuer=issuer)
        qr = cls.make_qr_data_uri(uri)
        return secret, uri, qr

    @classmethod
    def verify_and_enable(
        cls, office_serial: int, user_serial: int, secret: str, code: str
    ):
        """
        מאמת קוד ראשון; בהצלחה שומר 'mfa' למשתמש.
        """
        if not cls.verify_totp(secret, code):
            return ResponseManager.unauthorized("Invalid TOTP code")
        return cls.save_user_mfa(office_serial, user_serial, secret, method="totp")

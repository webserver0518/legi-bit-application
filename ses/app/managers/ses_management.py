# app/managers/ses_management.py
from flask import current_app
import os

import boto3


from .response_management import ResponseManager


class SESManager:
    """
    A simple SES utility class to manage connections and email sending.
    """

    _ses = None
    FROM_EMAIL = os.getenv("FROM_EMAIL", "no-reply@legi-bit.com")

    # ------------------------ Connection -------------------------

    @classmethod
    def init(cls):
        """
        Initialize the SES client once when the application starts.
        """
        if cls._ses is not None:
            return

        cls._ses = boto3.client("ses", region_name="eu-north-1")

    @classmethod
    def get_ses(cls):
        """
        Get the initialized SES client.
        """
        if cls._ses is None:
            raise Exception("SES client not initialized. Call SESManager.init() first.")
        return cls._ses

    @classmethod
    def send_email(cls, to_email: str, subject: str, message: str):
        current_app.logger.debug(
            f"Sending email to {to_email} with subject '{subject}'"
        )

        ses = cls.get_ses()

        try:
            ses.send_email(
                Source=cls.FROM_EMAIL,
                Destination={"ToAddresses": [to_email]},
                Message={
                    "Subject": {"Data": subject},
                    "Body": {"Html": {"Data": message}},
                },
            )
            current_app.email_metrics.labels(status='success', type='generic').inc()
            return ResponseManager.success(data="Email sent successfully")
        except Exception as e:
            current_app.logger.error(f"Error sending email: {e}")
            current_app.email_metrics.labels(status='error', type='generic').inc()
            return ResponseManager.internal(error=str(e))

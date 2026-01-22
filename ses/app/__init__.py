# app/__init__.py
import os
from flask import Flask
from prometheus_flask_exporter import PrometheusMetrics
from prometheus_client import Counter

from .managers.formatter_management import configure_logging, disable_all_logging
from .managers.ses_management import SESManager


def create_flask_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "fallback-secret-key")
    configure_logging(app)
    # disable_all_logging(app)

    SESManager.init()

    # Prometheus metrics
    metrics = PrometheusMetrics(app)
    # Email metrics
    app.email_metrics = Counter(
        'app_emails_sent_total', 
        'Total number of emails sent via SES',
        ['status', 'type']
    )

    # Register Blueprints
    from .routes import bp

    app.register_blueprint(bp)

    return app

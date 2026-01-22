# app/__init__.py
import os
from flask import Flask
from prometheus_flask_exporter import PrometheusMetrics
from prometheus_client import Counter

from .managers.formatter_management import configure_logging
from .managers.s3_management import S3Manager

def create_flask_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "fallback-secret-key")
    configure_logging(app)

    S3Manager.init()

    # Prometheus Metrics
    metrics = PrometheusMetrics(app)
    # File download metrics
    app.file_download_metrics = Counter(
        'app_file_downloads_total', 
        'Total number of file downloads/views',
        ['action', 'status']
    )
    
    # Register Blueprints
    from .routes import bp
    app.register_blueprint(bp)

    return app

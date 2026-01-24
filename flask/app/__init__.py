# app/__init__.py
import os
from flask import Flask
from flask_session import Session
from prometheus_flask_exporter import PrometheusMetrics
from prometheus_client import Counter, REGISTRY
 

from .managers.config import Config
from .managers.formatter_management import configure_logging


def create_flask_app():
    app = Flask(
        __name__,
        template_folder= os.path.join(os.path.dirname(__file__), 'templates'),
        static_folder= os.path.join(os.path.dirname(__file__), 'static')
    )
    app.config.from_object(Config)
    Config.init_app(app)

    metrics = PrometheusMetrics(app, path='/metrics', registry=REGISTRY)

    Session(app)

    # configure current_app.logger
    configure_logging(app)

    # Register Blueprints
    from .routes.site import site_bp
    from .routes.admin import admin_bp
    from .routes.user import user_bp

    app.register_blueprint(site_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(user_bp)


    @app.after_request
    def no_cache(response):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    

    # Login attempts counter
    app.login_metrics = Counter(
        'app_login_attempts_total', 
        'Number of login attempts', 
        ['status']
    )

    # Initialize metrics to 0 to ensure they appear in Grafana immediately
    app.login_metrics.labels(status='success').inc(0)
    app.login_metrics.labels(status='failure_credentials').inc(0)
    app.login_metrics.labels(status='failure_recaptcha_invalid').inc(0)
    app.login_metrics.labels(status='failure_missing_data').inc(0)
    app.login_metrics.labels(status='failure_recaptcha_low_score').inc(0)
    app.login_metrics.labels(status='failure_no_content').inc(0)
    app.login_metrics.labels(status='failure_mfa_code').inc(0)

    return app
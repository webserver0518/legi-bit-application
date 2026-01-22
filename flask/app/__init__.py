# app/__init__.py
import os
from flask import Flask
from flask_session import Session
from prometheus_flask_exporter import PrometheusMetrics
from prometheus_client import Counter
 

from .managers.config import DevelopmentConfig, ProductionConfig
from .managers.formatter_management import configure_logging


def create_flask_app(env= 'development'):
    if env == 'production':
        config_class = ProductionConfig
    else:
        config_class = DevelopmentConfig

    app = Flask(
        __name__,
        template_folder= os.path.join(os.path.dirname(__file__), 'templates'),
        static_folder= os.path.join(os.path.dirname(__file__), 'static')
    )
    app.config.from_object(config_class)
    config_class.init_app(app)
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
    
    # Prometheus Metrics
    metrics = PrometheusMetrics(app)
    # Login attempts counter
    app.login_metrics = Counter(
        'app_login_attempts_total', 
        'Number of login attempts', 
        ['status']
    )

    return app
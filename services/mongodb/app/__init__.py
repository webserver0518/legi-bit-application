# app/__init__.py
import os
from flask import Flask

from .managers.formatter_management import configure_logging
from .managers.mongodb_management import MongoDBManager

def create_flask_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "fallback-secret-key")
    configure_logging(app)

    MongoDBManager.init_client()

    # Register Blueprints
    from .routes import bp
    app.register_blueprint(bp)

    return app

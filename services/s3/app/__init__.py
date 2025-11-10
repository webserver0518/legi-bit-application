# app/__init__.py
import os
from flask import Flask

def create_flask_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "fallback-secret-key")
    
    # Register Blueprints
    from .routes import bp
    app.register_blueprint(bp)

    return app

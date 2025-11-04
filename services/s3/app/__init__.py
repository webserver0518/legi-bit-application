# app/__init__.py
import os
from flask import Flask
from .routes import bp

def create_flask_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "fallback-secret-key")
    app.register_blueprint(bp)
    return app

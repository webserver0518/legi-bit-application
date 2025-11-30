# app/config.py
import os
from redis import Redis
from datetime import timedelta


class Config:
    # Core
    SECRET_KEY = os.getenv("SECRET_KEY")  # fail fast in prod if missing

    # Redis
    SESSION_TYPE = os.getenv("SESSION_TYPE", "redis")
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = timedelta(hours=1)
    REDIS_HOST = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))

    # Services
    MONGODB_SERVICE_URL = os.getenv("MONGODB_SERVICE_URL")
    S3_SERVICE_URL = os.getenv("S3_SERVICE_URL")
    SES_SERVICE_URL = os.getenv("SES_SERVICE_URL")

    @staticmethod
    def init_app(app):
        app.config["SESSION_REDIS"] = Redis(
            host=Config.REDIS_HOST, port=Config.REDIS_PORT, db=Config.REDIS_DB
        )


class DevelopmentConfig(Config):
    DEBUG = True
    FLASK_ENV = "development"


class ProductionConfig(Config):
    DEBUG = False
    FLASK_ENV = "production"

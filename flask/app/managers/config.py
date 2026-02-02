import os
import json
import boto3
from botocore.exceptions import ClientError
from redis import Redis
from datetime import timedelta

def get_aws_secret(secret_name, key_name=None, region_name="eu-north-1"):
    """
    Fetches a secret from AWS Secrets Manager.
    If key_name is provided, returns the specific value from the secret JSON.
    Otherwise, returns the entire secret dictionary.
    """
    try:
        session = boto3.session.Session()
        client = session.client(
            service_name='secretsmanager',
            region_name=region_name
        )
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        print(f"Unable to fetch secret {secret_name} and key {key_name}: {e}")
        return None

    if 'SecretString' in get_secret_value_response:
        try:
            secret = json.loads(get_secret_value_response['SecretString'])
            if key_name:
                value = secret.get(key_name)
                if value:
                     print(f"Successfully fetched secret '{secret_name}' (key: '{key_name}') from AWS Secrets Manager.")
                return value
            print(f"Successfully fetched secret '{secret_name}' from AWS Secrets Manager.")
            return secret
        except json.JSONDecodeError:
            print(f"Successfully fetched raw secret '{secret_name}' from AWS Secrets Manager.")
            return get_secret_value_response['SecretString']
    
    return None


class Config:
    # Core
    SECRET_KEY = get_aws_secret("legibit/prod/backend", "SECRET_KEY") or os.getenv("SECRET_KEY")  # fail fast in prod if missing

    # Redis
    SESSION_TYPE = os.getenv("SESSION_TYPE", "redis")
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = timedelta(hours=1)
    REDIS_HOST = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))

    # Services
    # Note: If these service URLs are in the secret, they will be used. Otherwise fallback to env.
    MONGODB_SERVICE_URL = os.getenv("MONGODB_SERVICE_URL")
    S3_SERVICE_URL = os.getenv("S3_SERVICE_URL")
    SES_SERVICE_URL = os.getenv("SES_SERVICE_URL")

    # reCAPTCHA v3
    RECAPTCHA_SITE_KEY = get_aws_secret("legibit/prod/backend", "RECAPTCHA_SITE_KEY") or os.getenv("RECAPTCHA_SITE_KEY")
    RECAPTCHA_SECRET = get_aws_secret("legibit/prod/backend", "RECAPTCHA_SECRET") or os.getenv("RECAPTCHA_SECRET")
    
    # Environment
    POD_IP = os.getenv("MY_POD_IP", "Unknown")

    @staticmethod
    def init_app(app):
        # Redis Setup
        app.config["SESSION_REDIS"] = Redis(
            host=Config.REDIS_HOST, port=Config.REDIS_PORT, db=Config.REDIS_DB
        )

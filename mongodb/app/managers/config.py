import os
import json
import boto3
from botocore.exceptions import ClientError


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
        print(f"Unable to fetch secret {secret_name}: {e}")
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
    # Services
    # Fetch from AWS first, fallback to env var for local dev safety/transition
    MONGO_URI = get_aws_secret("legibit/prod/mongo", "MONGO_URI") or os.getenv("MONGO_URI")

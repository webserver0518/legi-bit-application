
import os
import boto3
import botocore.exceptions
from werkzeug.utils import secure_filename

from flask import current_app
from .response_management import ResponseManager

class S3Manager:

    _bucket = None
    _client = None
    MAX_UPLOAD_SIZE_MB = None


    # ------------------------ Connection -------------------------
    @classmethod
    def init(cls):
        """
        Initialize the S3 once when the application starts.
        """
        try:
            cls._bucket = os.getenv("S3_BUCKET")
            region_name = os.getenv("AWS_REGION")
            cls._client = boto3.client("s3", region_name=region_name)
            cls.MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", 10))
            return ResponseManager.success(data="S3 initialized")
        except Exception as e:
            current_app.logger.error(f"S3 initialization failed: {e}")
            return ResponseManager.internal("Failed to initialize S3 client")
    

    # ------------------------ List Keys -------------------------
    @classmethod
    def all_keys(cls, mode: str = "yield", prefix: str = ""):
        """Return all keys in the bucket."""
        try:
            paginator = cls._client.get_paginator("list_objects_v2")
            keys = []
            for page in paginator.paginate(Bucket=cls._bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    keys.append(obj["Key"])

            return ResponseManager.success(data={"keys": keys}, message=f"Found {len(keys)} keys")
        except botocore.exceptions.ClientError as e:
            current_app.logger.error(f"S3 all_keys() failed: {e}")
            return ResponseManager.internal("Failed to list S3 keys")


    # ------------------------ Generate Presigned POST -------------------------
    @classmethod
    def generate_presigned_post(cls, file_name: str, file_type: str, file_size: int, key: str):
        """
        Generate a presigned POST URL so the client uploads directly to S3.
        Validates file extension and size.
        """
        allowed_extensions = ['pdf']

        ext = file_name.rsplit(".", 1)[-1].lower()
        if ext not in allowed_extensions:
            return ResponseManager.bad_request("Invalid file type")

        max_bytes = cls.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            return ResponseManager.bad_request(f"File too large (> {cls.MAX_UPLOAD_SIZE_MB} MB)")

        try:
            presigned = cls._client.generate_presigned_post(
                Bucket=cls._bucket,
                Key=key,
                Fields={"Content-Type": file_type},
                Conditions=[
                    ["content-length-range", 0, max_bytes],
                    {"Content-Type": file_type},
                ],
                ExpiresIn=3600,  # 1 hour
            )
            data = {
                "presigned": presigned,
                "key": key,
                "safe_name": file_name,
            }
            return ResponseManager.success(data=data)
        except botocore.exceptions.BotoCoreError as e:
            current_app.logger.error("S3 presigned URL generation failed: %s", str(e))
            return ResponseManager.internal("Failed to generate presigned URL")


    # ------------------------ Generate Presigned GET -------------------------
    @classmethod
    def generate_presigned_get(cls, key: str):
        """Return a temporary download URL for a private S3 object."""
        try:
            url = cls._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": cls._bucket, "Key": key},
                ExpiresIn=3600,
            )
            ResponseManager.success(data=url)
        except botocore.exceptions.ClientError as e:
            current_app.logger.error("S3 presigned GET failed: %s", str(e))
            return ResponseManager.internal("Failed to generate download URL")


    # ------------------------ Upload -------------------------
    @classmethod
    def create(cls, file_obj, key: str):
        """Upload a file object to S3."""
        mime = getattr(file_obj, "mimetype", "application/octet-stream")
        file_obj.seek(0)

        try:
            cls._client.upload_fileobj(
                Fileobj=file_obj,
                Bucket=cls._bucket,
                Key=key,
                ExtraArgs={
                    "ContentType": mime,
                    "ServerSideEncryption": "AES256"
                }
            )
            return ResponseManager.created(data=key)
        except (botocore.exceptions.BotoCoreError, IOError) as e:
            # throw error to log
            current_app.logger.error("S3 upload failed: %s", str(e))
            return ResponseManager.internal(error="File upload failed")


    # ------------------------ Delete -------------------------
    @classmethod
    def delete(cls, key: str):
        """Delete a file from S3 by key."""
        try:
            cls._client.delete_object(
                Bucket=cls._bucket,
                Key=key
            )
            return ResponseManager.success(data=key)
        except botocore.exceptions.ClientError as e:
            current_app.logger.error("S3 delete failed: %s", str(e))
            return ResponseManager.internal("Failed to delete file from S3")

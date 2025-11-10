
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
    def _iter_keys(cls, prefix: str = ""):
        """Internal generator that always yields keys"""
        paginator = cls._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=cls._bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                yield obj["Key"]

    @classmethod
    def all_keys(cls, mode: str = "yield", prefix: str = ""):
        """
        If mode == 'yield'  → returns generator.
        If mode == 'log'    → logs keys directly and returns None.
        """
        try:
            if mode == "yield":
                return cls._iter_keys(prefix)
            elif mode == "log":
                for key in cls._iter_keys(prefix):
                    current_app.logger.debug(f"Found key: {key}")
                return None
            else:
                current_app.logger.debug(f"Unexpected mode: {mode}")
        except botocore.exceptions.ClientError as e:
            current_app.logger.error("S3 all_keys() failed: %s", str(e))
            return [] if mode == "yield" else None


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
            return {"error": "Invalid file type", "status": 400}

        max_bytes = cls.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            return {"error": f"File too large (>{cls.MAX_UPLOAD_SIZE_MB} MB)", "status": 400}

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
            return {
                "presigned": presigned,
                "key": key,
                "safe_name": file_name,
            }
        except botocore.exceptions.BotoCoreError as e:
            current_app.logger.error("S3 presigned URL generation failed: %s", str(e))
            return {"error": "Failed to generate presigned URL", "status": 500}


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
            return {"url": url}
        except botocore.exceptions.ClientError as e:
            current_app.logger.error("S3 presigned GET failed: %s", str(e))
            return {"error": "Failed to generate download URL", "status": 500}


    # ------------------------ Upload -------------------------
    @classmethod
    def create(cls, file_obj, key: str):
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
            return {"status": "ok", "key": key}
        except (botocore.exceptions.BotoCoreError, IOError) as e:
            # throw error to log
            current_app.logger.error("S3 upload failed: %s", str(e))
            return {"error": str(e)}


    # ------------------------ Delete -------------------------
    @classmethod
    def delete(cls, key: str):
        """
        Delete a single file from S3 by key (path inside the bucket).
        Example: cls.delete("office_name/123/file.pdf")
        """
        try:
            cls._client.delete_object(
                Bucket=cls._bucket,
                Key=key
            )
            return {"status": "ok", "key": key}
        except botocore.exceptions.ClientError as e:
            current_app.logger.error("S3 delete failed: %s", str(e))
            return {"error": str(e)}

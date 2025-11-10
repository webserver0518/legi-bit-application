# app/managers/s3_management.py
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
            return True
        except Exception as e:
            return False
    

    # ------------------------ List Keys -------------------------
    @classmethod
    def all_keys(cls, prefix: str = ""):
        """Return all keys in the bucket."""
        current_app.logger.debug(f"inside all_keys()")
        # debug inputs
        current_app.logger.debug(f"prefix: {prefix}")

        try:
            paginator = cls._client.get_paginator("list_objects_v2")
            keys = []
            for page in paginator.paginate(Bucket=cls._bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    keys.append(obj["Key"])

            # debug success
            current_app.logger.debug(f"returning success with results")
            return ResponseManager.success(data=keys)
        
        except botocore.exceptions.ClientError as e:
            # debug error
            current_app.logger.error(f"S3 all_keys() failed: {e}")
            current_app.logger.debug(f"returning internal server error")
            return ResponseManager.internal(error="Failed to list S3 keys")


    # ------------------------ Generate Presigned POST -------------------------
    @classmethod
    def generate_presigned_post(cls, file_name: str, file_type: str, file_size: int, key: str):
        """
        Generate a presigned POST URL so the client uploads directly to S3.
        Validates file extension and size.
        """
        current_app.logger.debug(f"inside generate_presigned_post()")
        # debug inputs
        current_app.logger.debug(f"file_name: {file_name}")
        current_app.logger.debug(f"file_type: {file_type}")
        current_app.logger.debug(f"file_size: {file_size}")
        current_app.logger.debug(f"key: {key}")

        if not file_name:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'file_name' is required")
            return ResponseManager.bad_request(error="file_name is required")
        if not file_type:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'file_type' is required")
            return ResponseManager.bad_request(error="file_type is required")
        if not file_size:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'file_size' is required")
            return ResponseManager.bad_request(error="file_size is required")
        if not key:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'key' is required")
            return ResponseManager.bad_request(error="key is required")
        
        allowed_extensions = ['pdf']

        ext = file_name.rsplit(".", 1)[-1].lower()
        if ext not in allowed_extensions:
            # debug bad request
            current_app.logger.debug(f"bad_request: Invalid file type '{ext}'")
            return ResponseManager.bad_request(error="Invalid file type")

        max_bytes = cls.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            # debug bad request
            current_app.logger.debug(f"bad_request: File too large ({file_size} bytes > {max_bytes} bytes)")
            return ResponseManager.bad_request(error=f"File too large ({file_size} bytes > {max_bytes} bytes)")

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
            # debug success
            current_app.logger.debug(f"returning success with keys {', '.join(data.keys())}")
            current_app.logger.debug(f"returning success with values {', '.join(data.values())}")
            return ResponseManager.success(data=data)
        
        except botocore.exceptions.BotoCoreError as e:
            # debug error
            current_app.logger.error(f"S3 presigned URL generation failed: {str(e)}")
            current_app.logger.debug(f"returning internal server error")
            return ResponseManager.internal(error="Failed to generate presigned URL")


    # ------------------------ Generate Presigned GET -------------------------
    @classmethod
    def generate_presigned_get(cls, key: str):
        """Return a temporary download URL for a private S3 object."""
        if not key:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'key' is required")
            return ResponseManager.bad_request(error="key is required")
        
        try:
            url = cls._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": cls._bucket, "Key": key},
                ExpiresIn=3600,
            )
            # debug success
            current_app.logger.debug(f"returning success with url: {url}")
            return ResponseManager.success(data=url)
        
        except botocore.exceptions.ClientError as e:
            # debug error
            current_app.logger.error(f"S3 presigned GET failed: {str(e)}")
            current_app.logger.debug(f"returning internal server error")
            return ResponseManager.internal(error="Failed to generate download URL")


    # ------------------------ Upload -------------------------
    @classmethod
    def create(cls, file_obj, key: str):
        """Upload a file object to S3."""

        if not file_obj:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'file_obj' is required")
            return ResponseManager.bad_request(error="file_obj is required")
        if not key:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'key' is required")
            return ResponseManager.bad_request(error="key is required")
        
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
            # debug success
            current_app.logger.debug(f"returning created with key: {key}")
            return ResponseManager.created(data=key)
        except (botocore.exceptions.BotoCoreError, IOError) as e:
            # debug error
            current_app.logger.error(f"S3 upload failed: {str(e)}")
            current_app.logger.debug(f"returning internal server error")
            return ResponseManager.internal(error="File upload failed")


    # ------------------------ Delete -------------------------
    @classmethod
    def delete(cls, key: str):
        """Delete a file from S3 by key."""

        if not key:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'key' is required")
            return ResponseManager.bad_request(error="key is required")
    
        try:
            cls._client.delete_object(
                Bucket=cls._bucket,
                Key=key
            )
            # debug success
            current_app.logger.debug(f"returning success with key: {key}")
            return ResponseManager.success(data=key)
        except botocore.exceptions.ClientError as e:
            # debug error
            current_app.logger.error(f"S3 delete failed: {str(e)}")
            current_app.logger.debug(f"returning internal server error")
            return ResponseManager.internal(error="Failed to delete file from S3")

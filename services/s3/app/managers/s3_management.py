import logging
import os
from io import BytesIO
import boto3
import botocore.exceptions
from werkzeug.utils import secure_filename

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(message)s")


class S3Manager:

    _bucket = None
    _client = None
    MAX_UPLOAD_SIZE_MB = None

    # ------------------------ Connection -------------------------

    @classmethod
    def init(cls):
        """
        Initialize the MongoClient once when the application starts.
        """
        cls._bucket = os.getenv("S3_BUCKET")
        region_name = os.getenv("AWS_REGION")
        cls._client = boto3.client("s3", region_name=region_name)
        cls.MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB"))

    @classmethod
    def _iter_keys(cls, prefix: str = ""):
        """Internal generator that always yields keys"""
        paginator = S3Manager._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=S3Manager._bucket, Prefix=prefix):
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
                return S3Manager._iter_keys(prefix)
            elif mode == "log":
                for key in S3Manager._iter_keys(prefix):
                    logging.info(f"Found key: {key}")
                return None
            else:
                logging.error(f"Unexpected mode: {mode}")
        except botocore.exceptions.ClientError as e:
            logging.error("S3 all_keys() failed: %s", str(e))
            return [] if mode == "yield" else None

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

        max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            return {"error": f"File too large (>{MAX_UPLOAD_SIZE_MB} MB)", "status": 400}

        try:
            presigned = S3Manager._client.generate_presigned_post(
                Bucket=S3Manager._bucket,
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
            import logging
            logging.error("S3 presigned URL generation failed: %s", str(e))
            return {"error": "Failed to generate presigned URL", "status": 500}

    @classmethod
    def generate_presigned_get(cls, key: str):
        """Return a temporary download URL for a private S3 object."""
        try:
            url = S3Manager._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3Manager._bucket, "Key": key},
                ExpiresIn=3600,
            )
            return {"url": url}
        except botocore.exceptions.ClientError as e:
            import logging
            logging.error("S3 presigned GET failed: %s", str(e))
            return {"error": "Failed to generate download URL", "status": 500}

    @classmethod
    def create(cls, file_obj, key: str):
        mime = getattr(file_obj, "mimetype", "application/octet-stream")

        # read file into memory so it does not close
        file_obj.seek(0)
        data = file_obj.read()
        body = BytesIO(data)

        try:
            S3Manager._client.upload_fileobj(
                Fileobj=body,
                Bucket=S3Manager._bucket,
                Key=key,
                ExtraArgs={
                    "ContentType": mime,
                    "ServerSideEncryption": "AES256"
                }
            )
            return {"status": "ok", "key": key}
        except (botocore.exceptions.BotoCoreError, IOError) as e:
            # throw error to log
            import logging
            logging.error("S3 upload failed: %s", str(e))
            return {"error": str(e)}

    @classmethod
    def delete(cls, key: str):
        """
        Delete a single file from S3 by key (path inside the bucket).
        Example: S3Manager.delete("office_name/123/file.pdf")
        """
        try:
            S3Manager._client.delete_object(
                Bucket=S3Manager._bucket,
                Key=key
            )
            return {"status": "ok", "key": key}
        except botocore.exceptions.ClientError as e:
            import logging
            logging.error("S3 delete failed: %s", str(e))
            return {"error": str(e)}

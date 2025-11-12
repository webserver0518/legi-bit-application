from flask import current_app
import os
import json
from typing import Optional
import redis

from .response_management import ResponseManager


class RedisManager:
    """
    A simple Redis utility class to manage connections and basic cache operations.
    Fully compatible with AWS ElastiCache (Valkey/Redis) and local Redis for development.
    """

    _client = None
    REDIS_HOST = None
    REDIS_PORT = None
    REDIS_DB = None
    REDIS_PASSWORD = None
    REDIS_SOCKET_TIMEOUT = None
    REDIS_CONNECT_TIMEOUT = None
    REDIS_USE_SSL = None

    # ------------------------ Connection -------------------------

    @classmethod
    def init(cls):
        """
        Initialize the Redis client once when the application starts.
        """
        if cls._client is not None:
            return  # already initialized

        print("Initializing RedisManager...")

        cls.REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
        cls.REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
        cls.REDIS_DB = int(os.getenv("REDIS_DB", 0))
        cls.REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
        cls.REDIS_SOCKET_TIMEOUT = float(os.getenv("REDIS_SOCKET_TIMEOUT", "3"))
        cls.REDIS_CONNECT_TIMEOUT = float(os.getenv("REDIS_CONNECT_TIMEOUT", "3"))
        cls.REDIS_USE_SSL = os.getenv("REDIS_USE_SSL", "true").lower() == "true"


        if "amazonaws.com" not in cls.REDIS_HOST:
            cls.REDIS_USE_SSL = False

        print(f"REDIS_HOST: {cls.REDIS_HOST}")
        print(f"REDIS_PORT: {cls.REDIS_PORT}")
        print(f"REDIS_DB: {cls.REDIS_DB}")
        print(f"REDIS_USE_SSL: {cls.REDIS_USE_SSL}")

        try:
            cls._client = redis.StrictRedis(
                host=cls.REDIS_HOST,
                port=cls.REDIS_PORT,
                password=cls.REDIS_PASSWORD,
                db=cls.REDIS_DB,
                socket_timeout=cls.REDIS_SOCKET_TIMEOUT,
                socket_connect_timeout=cls.REDIS_CONNECT_TIMEOUT,
                decode_responses=True,
                ssl=cls.REDIS_USE_SSL,  # ✅ Required for AWS ElastiCache (Valkey)
            )

            cls._client.ping()
            print(
                f"[Redis] ✅ Connected successfully to {cls.REDIS_HOST}:{cls.REDIS_PORT} "
                f"(SSL={cls.REDIS_USE_SSL})"
            )

        except Exception as e:
            print(f"[Redis] ❌ Connection failed: {e}")
            print("[Redis] Attempting fallback to local Redis on localhost:6379 ...")

            # fallback
            try:
                cls._client = redis.StrictRedis(host="redis", port=cls.REDIS_PORT, decode_responses=True)
                cls._client.ping()
                print("[Redis] 🔄 Fallback successful (connected to local Redis)")
            except Exception as fallback_error:
                print(f"[Redis] ❌ Fallback failed: {fallback_error}")
                cls._client = None

    @classmethod
    def _get_client(cls) -> redis.StrictRedis:
        """
        Lazy initialize and return the Redis client.

        Returns:
            redis.StrictRedis: Active Redis client.
        """
        if cls._client is None:
            current_app.logger.debug("Redis client not initialized — calling init()")
            cls.init()
        return cls._client

    # ------------------------ Basic Operations -------------------------

    @classmethod
    def set_value(cls, key: str, value, ttl: Optional[int] = 300):
        """
        Set a key-value pair in Redis with an optional TTL (seconds).
        """
        current_app.logger.debug("inside set_value()")
        current_app.logger.debug(f"key: {key}, ttl: {ttl}")

        if not key:
            current_app.logger.debug("returning bad_request: 'key' is required")
            return ResponseManager.bad_request(error="'key' is required")

        try:
            client = cls._get_client()
            serialized = json.dumps(value, default=str)
            client.setex(key, ttl, serialized)
            current_app.logger.debug(f"[Redis] SET {key} (ttl={ttl})")
            return ResponseManager.success(data=True)

        except Exception as e:
            current_app.logger.error(f"[Redis:set_value] {e}")
            return ResponseManager.internal(error=str(e))

    @classmethod
    def get_value(cls, key: str):
        """
        Retrieve a value from Redis by key.
        """
        current_app.logger.debug("inside get_value()")
        current_app.logger.debug(f"key: {key}")

        if not key:
            current_app.logger.debug("returning bad_request: 'key' is required")
            return ResponseManager.bad_request(error="'key' is required")

        try:
            client = cls._get_client()
            data = client.get(key)

            if not data:
                current_app.logger.debug(f"[Redis] GET {key} → not found")
                return ResponseManager.not_found(error="Key not found")

            deserialized = json.loads(data)
            ttl = client.ttl(key)
            current_app.logger.debug(f"[Redis] GET {key} → success (ttl={ttl})")

            return ResponseManager.success(data={"value": deserialized, "ttl": ttl})

        except Exception as e:
            current_app.logger.error(f"[Redis:get_value] {e}")
            return ResponseManager.internal(error=str(e))

    @classmethod
    def delete_key(cls, key: str):
        """
        Delete a key from Redis.
        """
        current_app.logger.debug("inside delete_key()")
        current_app.logger.debug(f"key: {key}")

        if not key:
            current_app.logger.debug("returning bad_request: 'key' is required")
            return ResponseManager.bad_request(error="'key' is required")

        try:
            client = cls._get_client()
            deleted = client.delete(key)
            current_app.logger.debug(f"[Redis] DEL {key} → {deleted} record(s) deleted")

            if deleted == 0:
                current_app.logger.debug(f"returning not_found: key '{key}' not found")
                return ResponseManager.not_found(error="Key not found")

            return ResponseManager.success(data=deleted)

        except Exception as e:
            current_app.logger.error(f"[Redis:delete_key] {e}")
            return ResponseManager.internal(error=str(e))

    @classmethod
    def flush_all(cls):
        """
        Flush all keys in the Redis database. (Use with caution!)
        """
        current_app.logger.debug("inside flush_all()")

        try:
            client = cls._get_client()
            client.flushdb()
            current_app.logger.warning(f"[Redis] ⚠️ Flushed all keys from DB {cls.REDIS_DB}")
            return ResponseManager.success(data=True)

        except Exception as e:
            current_app.logger.error(f"[Redis:flush_all] {e}")
            return ResponseManager.internal(error=str(e))

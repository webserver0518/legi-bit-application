# app/managers/rate_limiter.py
import time
from functools import wraps
from flask import request, current_app
from .response_management import ResponseManager


class RateLimiter:
    @staticmethod
    def _redis():
        return current_app.config["SESSION_REDIS"]

    @staticmethod
    def hit(key_prefix: str, limit: int, window_seconds: int):
        """
        Increase attempts counter in Redis and return False if limit exceeded.
        """
        bucket = int(time.time() // window_seconds)
        key = f"{key_prefix}:{bucket}"

        redis = RateLimiter._redis()
        attempts = redis.incr(key)

        if attempts == 1:
            redis.expire(key, window_seconds)

        return attempts <= limit

    @staticmethod
    def limit(limit: int, window_seconds: int = 60, key_func=None):
        """
        Decorator for Flask routes.
        key_func = function that receives request and returns a key string.
        """

        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # default key: IP address
                key_prefix = (
                    key_func(request)
                    if key_func
                    else f"rl:{request.remote_addr or 'unknown'}"
                )

                allowed = RateLimiter.hit(key_prefix, limit, window_seconds)
                if not allowed:
                    return ResponseManager.error(
                        "Too many attempts. Try again later.", status=429
                    )

                return func(*args, **kwargs)

            return wrapper

        return decorator

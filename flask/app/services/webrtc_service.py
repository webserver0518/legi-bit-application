# flask/app/services/webrtc_service.py
import os, time, secrets, json, threading
from typing import Any, Dict, Optional

try:
    from flask import current_app
except Exception:
    current_app = None  # type: ignore


# ---------- In-memory fallback (ל־dev/וורקר יחיד) ----------
class InMemorySessionStore:
    def __init__(self, ttl_seconds: int = 600):
        self.ttl = ttl_seconds
        self._d: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def _prune(self):
        now = time.time()
        stale = [c for c, v in self._d.items() if now - v["ts"] > self.ttl]
        for c in stale:
            self._d.pop(c, None)

    def _gen_code(self) -> str:
        return f"{secrets.randbelow(900000) + 100000}"  # 6 ספרות

    def create(self, meta: Optional[Dict[str, Any]] = None) -> str:
        self._prune()
        code = self._gen_code()
        with self._lock:
            self._d[code] = {"offer": None, "answer": None, "meta": meta or {}, "ts": time.time()}
        return code

    def exists(self, code: str) -> bool:
        self._prune()
        return code in self._d

    def set_offer(self, code: str, offer: Dict[str, Any]) -> bool:
        with self._lock:
            s = self._d.get(code)
            if not s:
                return False
            s["offer"] = offer
            s["ts"] = time.time()
            return True

    def get_offer(self, code: str) -> Optional[Dict[str, Any]]:
        self._prune()
        s = self._d.get(code)
        return s and s["offer"]

    def set_answer(self, code: str, answer: Dict[str, Any]) -> bool:
        with self._lock:
            s = self._d.get(code)
            if not s:
                return False
            s["answer"] = answer
            s["ts"] = time.time()
            return True

    def get_answer(self, code: str) -> Optional[Dict[str, Any]]:
        self._prune()
        s = self._d.get(code)
        return s and s["answer"]


# ---------- Redis store (לפרודקשן/ריבוי וורקרים) ----------
class RedisSessionStore:
    def __init__(self, redis_client, ttl_seconds: int = 600, prefix: str = "webrtc:session:"):
        self.r = redis_client
        self.ttl = ttl_seconds
        self.prefix = prefix

    def _key(self, code: str) -> str:
        return f"{self.prefix}{code}"

    def _gen_code(self) -> str:
        return f"{secrets.randbelow(900000) + 100000}"

    def create(self, meta: Optional[Dict[str, Any]] = None) -> str:
        # מוודא ייחודיות בסיסית
        for _ in range(10):
            code = self._gen_code()
            key = self._key(code)
            if not self.r.exists(key):
                payload = {
                    "offer": None,
                    "answer": None,
                    "meta": meta or {},
                    "ts": time.time(),
                }
                self.r.setex(key, self.ttl, json.dumps(payload))
                return code
        raise RuntimeError("Failed to allocate session code")

    def exists(self, code: str) -> bool:
        return bool(self.r.exists(self._key(code)))

    def _load(self, code: str) -> Optional[Dict[str, Any]]:
        raw = self.r.get(self._key(code))
        if not raw:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        return json.loads(raw)

    def _save(self, code: str, obj: Dict[str, Any]) -> None:
        obj["ts"] = time.time()
        self.r.setex(self._key(code), self.ttl, json.dumps(obj))

    def set_offer(self, code: str, offer: Dict[str, Any]) -> bool:
        obj = self._load(code)
        if not obj:
            return False
        obj["offer"] = offer
        self._save(code, obj)
        return True

    def get_offer(self, code: str) -> Optional[Dict[str, Any]]:
        obj = self._load(code)
        return obj and obj.get("offer")

    def set_answer(self, code: str, answer: Dict[str, Any]) -> bool:
        obj = self._load(code)
        if not obj:
            return False
        obj["answer"] = answer
        self._save(code, obj)
        return True

    def get_answer(self, code: str) -> Optional[Dict[str, Any]]:
        obj = self._load(code)
        return obj and obj.get("answer")


# ---------------- Store factory ----------------

class WebRTCStoreUnavailable(RuntimeError):
    """Raised when WebRTC store cannot be initialized (e.g. Redis missing)."""
    pass


_STORE = None


def webrtc_store():
    """
    מחזיר את ה־store הגלובלי ל־WebRTC.

    דרישות:
    - חייב להיות current_app
    - חייב להיות current_app.config["SESSION_REDIS"]
    אין יותר נפילה לזיכרון. אם אין Redis → נזרקת WebRTCStoreUnavailable.
    """
    global _STORE

    if _STORE is not None:
        return _STORE

    if current_app is None:
        # לא אמור לקרות בפרוד, אבל שיהיה ברור בלוגים
        raise WebRTCStoreUnavailable("WebRTC store requires Flask app context")

    redis_conn = current_app.config.get("SESSION_REDIS")
    if not redis_conn:
        raise WebRTCStoreUnavailable(
            "WebRTC store requires SESSION_REDIS (Redis). "
            "In-memory fallback is disabled."
        )

    ttl = int(os.getenv("WEBRTC_TTL", "600"))
    _STORE = RedisSessionStore(redis_conn, ttl_seconds=ttl)
    return _STORE

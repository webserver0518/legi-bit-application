# flask/app/services/webrtc_service.py
import os, json, random, string, time
import redis

DEFAULT_TTL = int(os.getenv("WEBRTC_TTL", "600"))
REDIS_URL = os.getenv("REDIS_URL")  # למשל: redis://localhost:6379/0
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB   = int(os.getenv("REDIS_DB", "0"))

class WebRTCStoreUnavailable(Exception):
    pass

def _redis_client():
    try:
        if REDIS_URL:
            r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        else:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)
        # ping
        r.ping()
        return r
    except Exception as e:
        raise WebRTCStoreUnavailable(str(e))

def _code():
    return "".join(random.choice(string.digits) for _ in range(6))

PREFIX = "webrtc"
KEY = lambda code: f"{PREFIX}:sess:{code}"
ZPENDING = f"{PREFIX}:pending"   # ZSET score=expires_at (epoch)

class RedisWebRTCStore:
    def __init__(self, r):
        self.r = r

    # --- create/list/exists ---
    def create(self, meta: dict, ttl: int = DEFAULT_TTL) -> str:
        # מייצר קוד חדש שלא קיים
        for _ in range(20):
            code = _code()
            if not self.r.exists(KEY(code)):
                break
        else:
            raise RuntimeError("Failed generating unique code")

        now = int(time.time())
        exp = now + int(ttl)

        payload = {
            "meta": meta or {},
            "created_at": now,
            "expires_at": exp,
            "offer": None,
            "answer": None,
        }
        k = KEY(code)
        self.r.set(k, json.dumps(payload))
        self.r.expireat(k, exp)
        # ברשימת ממתינים
        self.r.zadd(ZPENDING, {code: exp})
        return code

    def exists(self, code: str) -> bool:
        return bool(self.r.exists(KEY(code)))

    def get(self, code: str) -> dict | None:
        raw = self.r.get(KEY(code))
        return json.loads(raw) if raw else None

    def _set(self, code: str, obj: dict) -> bool:
        k = KEY(code)
        if not self.r.exists(k):
            return False
        # שמירה + כיבוד תוקף קיים
        ttl_left = self.r.ttl(k)
        expires_at = int(time.time()) + max(1, int(ttl_left)) if ttl_left and ttl_left > 0 else int(time.time()) + DEFAULT_TTL
        obj["expires_at"] = expires_at
        self.r.set(k, json.dumps(obj))
        self.r.expireat(k, expires_at)
        self.r.zadd(ZPENDING, {code: expires_at})
        return True

    # --- offer/answer ---
    def set_offer(self, code: str, offer: dict) -> bool:
        obj = self.get(code)
        if not obj:
            return False
        obj["offer"] = offer
        return self._set(code, obj)

    def get_offer(self, code: str) -> dict | None:
        obj = self.get(code)
        return obj.get("offer") if obj else None

    def set_answer(self, code: str, answer: dict) -> bool:
        obj = self.get(code)
        if not obj:
            return False
        obj["answer"] = answer
        ok = self._set(code, obj)
        # ברגע שיש תשובה (הטכנאי התחבר) – כבר לא “ממתין”
        try:
            self.r.zrem(ZPENDING, code)
        except Exception:
            pass
        return ok

    def get_answer(self, code: str) -> dict | None:
        obj = self.get(code)
        return obj.get("answer") if obj else None

    def get_meta(self, code: str) -> dict | None:
        obj = self.get(code)
        return obj.get("meta") if obj else None

    # --- maintenance actions ---
    def delete(self, code: str) -> bool:
        k = KEY(code)
        self.r.delete(k)
        self.r.zrem(ZPENDING, code)
        return True

    def extend(self, code: str, seconds: int) -> int:
        """מאריך תוקף ב־seconds; מחזיר TTL חדש (שניות שנותרו)."""
        k = KEY(code)
        if not self.r.exists(k):
            return 0
        now = int(time.time())
        ttl_left = self.r.ttl(k)
        if ttl_left is None or ttl_left < 0:
            ttl_left = 0
        new_exp = now + ttl_left + int(seconds)
        self.r.expireat(k, new_exp)
        # עדכון expires_at באובייקט + בזט
        obj = self.get(code) or {}
        obj["expires_at"] = new_exp
        self.r.set(k, json.dumps(obj))
        self.r.zadd(ZPENDING, {code: new_exp})
        return int(self.r.ttl(k) or 0)

    def list_pending(self, limit: int = 50) -> list[dict]:
        now = int(time.time())
        # מנקים ישנים
        try:
            self.r.zremrangebyscore(ZPENDING, "-inf", now - 1)
        except Exception:
            pass
        codes = self.r.zrangebyscore(ZPENDING, now, "+inf", start=0, num=limit)
        items = []
        for code in codes:
            obj = self.get(code)
            if not obj:
                continue
            exp = int(obj.get("expires_at") or 0)
            items.append({
                "code": code,
                "meta": obj.get("meta") or {},
                "created_at": int(obj.get("created_at") or now),
                "expires_at": exp,
                "ttl_left": max(0, exp - now),
                "has_offer": bool(obj.get("offer")),
                "has_answer": bool(obj.get("answer")),
            })
        return items

def webrtc_store() -> RedisWebRTCStore:
    r = _redis_client()
    return RedisWebRTCStore(r)

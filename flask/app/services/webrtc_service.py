import time, secrets, threading

class WebRTCSessionStore:
    def __init__(self, ttl_seconds=600):
        self.ttl = ttl_seconds
        self._d = {}
        self._lock = threading.Lock()

    def _prune(self):
        now = time.time()
        for code in [c for c,v in self._d.items() if now - v["ts"] > self.ttl]:
            self._d.pop(code, None)

    def _gen_code(self) -> str:
        return f"{secrets.randbelow(900000) + 100000}"  # 6 ספרות

    def create(self, meta=None) -> str:
        self._prune()
        code = self._gen_code()
        with self._lock:
            self._d[code] = {"offer": None, "answer": None, "meta": meta or {}, "ts": time.time()}
        return code

    def exists(self, code) -> bool:
        self._prune(); return code in self._d

    def set_offer(self, code, offer) -> bool:
        with self._lock:
            s = self._d.get(code); 
            if not s: return False
            s["offer"] = offer; s["ts"] = time.time(); return True

    def get_offer(self, code):
        self._prune(); s = self._d.get(code); return s and s["offer"]

    def set_answer(self, code, answer) -> bool:
        with self._lock:
            s = self._d.get(code); 
            if not s: return False
            s["answer"] = answer; s["ts"] = time.time(); return True

    def get_answer(self, code):
        self._prune(); s = self._d.get(code); return s and s["answer"]

STORE = WebRTCSessionStore(ttl_seconds=600)

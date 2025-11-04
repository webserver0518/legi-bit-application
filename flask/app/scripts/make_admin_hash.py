from werkzeug.security import generate_password_hash
import json, sys

pw = sys.argv[1] if len(sys.argv) > 1 else input("Password: ")
doc = {
    "password_hash": generate_password_hash(pw),
    "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z"
}
print(json.dumps(doc, indent=2))
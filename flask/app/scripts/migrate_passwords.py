import os
from werkzeug.security import generate_password_hash
from app.managers.mongodb_management import MongoDBManager

def migrate_passwords():
    MongoDBManager.init()
    users = MongoDBManager._get_records(
        MongoDBManager.users_collection_name,
        projection={"_id": 1, "username": 1, "password": 1, "password_hash": 1}
    )

    print(f"🔍 Found {len(users)} users to check...")
    migrated = 0

    for user in users:
        user_id = user.get("_id")
        plain_pw = user.get("password")
        hash_pw = user.get("password_hash", None)

        # Skip if already hashed or missing password
        if hash_pw or not plain_pw:
            continue

        new_hash = generate_password_hash(plain_pw)
        updated = MongoDBManager._update_fields(
            MongoDBManager.users_collection_name,
            {"_id": user_id},
            {"password_hash": new_hash},  # we'll unset it below
            operator="$set",
            multiple=False
        )

        # Explicitly remove the plaintext password
        MongoDBManager._update_fields(
            MongoDBManager.users_collection_name,
            {"_id": user_id},
            {"password": ""},  # field name to remove
            operator="$unset",
            multiple=False
        )

        if updated:
            migrated += 1
            print(f"✅ Migrated user: {user.get('username')}")
        else:
            print(f"❌ did not migrate user: {user.get('username')}")

    print(f"🏁 Migration complete — {migrated} user(s) updated.")

#if __name__ == "__main__":
#    migrate_passwords()

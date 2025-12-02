from functools import wraps
from flask import session, redirect, url_for, flash, current_app
from werkzeug.security import check_password_hash

from ..services import mongodb_service
from ..managers.response_management import ResponseManager
from ..constants.constants_mongodb import MongoDBEntity, MongoDBFilters


class AuthenticationManager:
    @classmethod
    def _authenticate_admin(cls, password):
        # get password hashes
        admin_passwords_res = mongodb_service.get_admin_passwords()

        if not ResponseManager.is_success(response=admin_passwords_res):
            current_app.logger.debug("failed to get admin password hashes")
            return admin_passwords_res
        
        if ResponseManager.is_no_content(response=admin_passwords_res):
            current_app.logger.debug("no admin passwords configured")
            return ResponseManager.unauthorized("No admin passwords configured")
    
        # validate creds
        admin_passwords_hashes = ResponseManager.get_data(response=admin_passwords_res)
        for row in admin_passwords_hashes:
            hashed = row.get("password_hash")
            if hashed and check_password_hash(hashed, password):
                return ResponseManager.success()

        current_app.logger.debug("unauthorized admin attempt")
        return ResponseManager.unauthorized("Invalid admin password")

    @classmethod
    def _authenticate_user(cls, username, password):
        # get user by username (cross-tenant search; result includes office_serial)
        user_res = mongodb_service.search_entities(
            entity=MongoDBEntity.USERS,
            filters=MongoDBFilters.User.by_username(username=username),
            limit=1,
        )

        if not ResponseManager.is_success(response=user_res):
            current_app.logger.debug("failed to get user")
            return user_res
        
        if ResponseManager.is_no_content(response=user_res):
            current_app.logger.debug(f"no content on get user='{username}'")
            return ResponseManager.no_content("User not found")

        # extract user and office serial
        users = ResponseManager.get_data(response=user_res)
        user = users[0]
        office_serial = user.pop("office_serial", None)

        # validate creds
        stored_hash = user.get("password_hash")
        if not stored_hash or not check_password_hash(stored_hash, password):
            current_app.logger.debug(
                f"unauthorized '{username}' login attempt to office {office_serial}"
            )
            return ResponseManager.unauthorized(message="Invalid credentials")

        # fetch office name via offices registry
        office_name = None
        if office_serial is not None:
            office_res = mongodb_service.search_offices(
                filters={"serial": int(office_serial)},
                projection={"_id": 0, "name": 1},
                limit=1,
            )
            if ResponseManager.is_success(office_res):
                offices = ResponseManager.get_data(office_res) or []
                if offices:
                    office_name = offices[0].get("name")

        result = {
            "user": user,
            "office": {"serial": office_serial, "name": office_name},
        }
        return ResponseManager.success(data=result)

    @classmethod
    def authenticate_login(cls, username, password):
        # ---------- Admin login ----------
        if username == "admin":
            valid_admin_login_res = cls._authenticate_admin(password=password)
            if not ResponseManager.is_success(response=valid_admin_login_res):
                return valid_admin_login_res

            ctx = {
                "user": {"username": "admin", "roles": ["admin"]},
                "office": {"serial": None, "name": None},
            }
            return ResponseManager.success(data=ctx)

        # ---------- User login ----------
        valid_user_login_res = cls._authenticate_user(
            username=username, password=password
        )
        if not ResponseManager.is_success(response=valid_user_login_res):
            return valid_user_login_res
        if ResponseManager.is_no_content(response=valid_user_login_res):
            return valid_user_login_res

        return valid_user_login_res


class AuthorizationManager:
    @classmethod
    def regenerate_session(cls):
        """
        Prevent session fixation by regenerating a fresh session ID.
        Clears old session data safely and forces Flask to create a new session.
        """
        old_data = dict(session)
        session.clear()
        session.update(old_data)
        session.modified = True

    @classmethod
    def get(cls):
        return dict(session)

    @classmethod
    def logout(cls):
        session.clear()

    @classmethod
    def login_required(cls, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if cls.is_logged_out():
                current_app.logger.debug("require_login failed")
                flash("Please log in first", "danger")
                return redirect(url_for("site.home"))
            return func(*args, **kwargs)

        return wrapper

    @classmethod
    def logout_required(cls, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if cls.is_logged_in():
                current_app.logger.debug("require_logout failed")
                flash("Please log out first", "danger")
                return redirect(url_for("site.dashboard"))
            return func(*args, **kwargs)

        return wrapper

    @classmethod
    def admin_required(cls, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if cls.is_logged_out():
                flash("Please log in first", "danger")
                return redirect(url_for("site.home"))

            if not cls.is_admin():
                flash("Admin access required", "danger")
                return ResponseManager.forbidden("Admin access required")

            return func(*args, **kwargs)

        return wrapper

    @classmethod
    def get_login_context(cls):
        return session.get("login_context", None)

    @classmethod
    def delete_login_context(cls):
        session.pop("login_context", None)

    @classmethod
    def is_logged_in(cls):
        return cls.get_login_context() is not None

    @classmethod
    def is_logged_out(cls):
        return not cls.is_logged_in()

    @classmethod
    def set_login_context(cls, ctx: dict = None):
        if not ctx:
            cls.delete_login_context()
            return
        session["login_context"] = ctx.copy()

    @classmethod
    def get_user_context(cls):
        ctx = cls.get_login_context()
        return ctx.get("user", {}) if ctx else {}

    @classmethod
    def get_office_context(cls):
        ctx = cls.get_login_context()
        return ctx.get("office", {}) if ctx else {}

    @classmethod
    def get_roles(cls):
        if user_ctx := cls.get_user_context():
            return user_ctx.get("roles", [])
        else:
            return []

    @classmethod
    def is_admin(cls):
        return "admin" in cls.get_roles()

    @classmethod
    def get_office_serial(cls):
        if office_ctx := cls.get_office_context():
            return office_ctx.get("serial", None)
        else:
            return None

    @classmethod
    def get_office_name(cls):
        if office_ctx := cls.get_office_context():
            return office_ctx.get("name", None)
        else:
            return None

    @classmethod
    def get_user_serial(cls):
        if user_ctx := cls.get_user_context():
            return user_ctx.get("serial", None)
        else:
            return None

    @classmethod
    def get_username(cls):
        if user_ctx := cls.get_user_context():
            return user_ctx.get("username", None)
        else:
            return None

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
        admin_password_hashes_res = mongodb_service.get_admin_passwords_hashes()

        if not ResponseManager.is_success(response=admin_password_hashes_res):
            msg = f"failed to get admin password hashes"
            current_app.logger.debug(msg)
            return admin_password_hashes_res

        admin_password_hashes = ResponseManager.get_data(
            response=admin_password_hashes_res
        )

        # validate creds
        for admin_password_hash in admin_password_hashes:
            hashed = admin_password_hash.get("password_hash")
            if hashed and check_password_hash(hashed, password):
                return ResponseManager.success()

        msg = f"unauthorized admin attempt to with password '{password}'"
        current_app.logger.debug(msg)
        return ResponseManager.unauthorized(msg)

    @classmethod
    def _authenticate_user(cls, username, password):
        # get user
        user_res = mongodb_service.get_entity(
            entity=MongoDBEntity.USERS,
            filters=MongoDBFilters.User.by_username(username=username),
            limit=1,
        )

        if not ResponseManager.is_success(response=user_res):
            msg = f"failed to get user"
            current_app.logger.debug(msg)
            return user_res

        if ResponseManager.is_no_content(response=user_res):
            msg = f"not content on get user= '{username}'"
            current_app.logger.debug(msg)
            return user_res

        # extract user and office serial
        user = ResponseManager.get_data(response=user_res)
        user = user[0]
        office_serial = user.pop("office_serial", None)

        # validate creds
        stored_hash = user.get("password_hash")
        if not stored_hash or not check_password_hash(stored_hash, password):
            msg = f"unauthorized '{username}' login attempt to 'office {office_serial}' with password '{password}'"
            current_app.logger.debug(msg)
            return ResponseManager.unauthorized(message=msg)

        # get office name
        office_name_res = mongodb_service.get_office_name(office_serial=office_serial)
        if not ResponseManager.is_success(response=office_name_res):
            return office_name_res
        office_name = ResponseManager.get_data(response=office_name_res)

        result = {
            "user": user,
            "office": {"serial": office_serial, "name": office_name},
        }
        return ResponseManager.success(data=result)

    @classmethod
    def authenticate_login(cls, username, password):
        context = {}

        # ---------- Admin login ----------
        if username == "admin":
            valid_admin_login_res = cls._authenticate_admin(password=password)

            if not ResponseManager.is_success(response=valid_admin_login_res):
                return valid_admin_login_res

            # update context
            context = {
                "user": {
                    "username": "admin",
                    "roles": ["admin"],
                },
                "office": {
                    "serial": None,
                    "name": None,
                },
            }

        # ---------- User login ----------
        else:
            valid_user_login_res = cls._authenticate_user(
                username=username, password=password
            )

            if not ResponseManager.is_success(response=valid_user_login_res):
                return valid_user_login_res

            if ResponseManager.is_no_content(response=valid_user_login_res):
                return valid_user_login_res

            # extract user, office serial, office name
            valid_user_login = ResponseManager.get_data(response=valid_user_login_res)

            # update context
            context = valid_user_login

        return ResponseManager.success(data=context)


class AuthorizationManager:

    @classmethod
    def regenerate_session():
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

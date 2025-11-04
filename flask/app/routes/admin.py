# app/routes/admin.py
from flask import Blueprint, render_template, request, session, flash, redirect, url_for, current_app
from werkzeug.security import generate_password_hash
from datetime import datetime

from ..services import mongodb_service
from ..managers.response_management import ResponseManager
from ..managers.json_management import JSONManager

admin_bp = Blueprint('admin', __name__)


# ---------------- HELPERS ---------------- #

# ---------------- DASHBOARD ---------------- #

@admin_bp.route('/base_admin_dashboard')
def base_admin_dashboard():
    return render_template("base_admin_dashboard.html", username=session.get("username"))


# ---------------- USER MANAGEMENT ---------------- #

@admin_bp.route('/load_users_management')
def load_users_management():

    try:
        all_users_res = mongodb_service.get_all_users()

        if not all_users_res["success"]:
            return ResponseManager.error(all_users_res["error"])

        if not all_users_res["data"]:
            return ResponseManager.error("No users found")

        users = all_users_res["data"]
        return render_template("admin_components/users_management.html", users=users)
    except Exception as e:
        current_app.logger.error(f"❌ load_users_management error: {e}")
        return ResponseManager.error(str(e))


@admin_bp.route('/get_roles_list')
def get_roles_list():

    try:
        return JSONManager.jsonify("roles.json")
    except Exception as e:
        current_app.logger.error(f"❌ load_users_management error: {e}")
        return ResponseManager.error(str(e))


@admin_bp.route('/manage_user', methods=['POST'])
def manage_user():

    try:
        action = request.form.get("action")
        username = request.form.get("username")
        password = request.form.get("password")
        email = request.form.get("email", "")
        office_name = request.form.get("office_name", session.get("office_name"))
        roles = request.form.getlist("roles[]")  # multiple checkboxes
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if not username:
            return ResponseManager.bad_request("Missing username")

        if action == "add":

            if not password:
                return ResponseManager.bad_request("Password is required")

            # --- Check if user exists ---
            user_exist_res = mongodb_service.is_username_exist(username=username)
            if not ResponseManager.is_success(response=user_exist_res):
                flash(ResponseManager.get_error(response=user_exist_res), "danger")
                return user_exist_res
            user_exist = ResponseManager.get_data(response=user_exist_res)

            if "admin" in roles and len(roles) > 1:
                return ResponseManager.bad_request("Manager role is exclusive")

            # --- Resolve or create the office ---
            office_serial_res = mongodb_service.get_or_create_office_serial(office_name=office_name)
            if not ResponseManager.is_success(response=office_serial_res):
                flash(ResponseManager.get_error(response=office_serial_res), "danger")
                return office_serial_res
            office_serial = ResponseManager.get_data(response=office_serial_res)

            # --- Get next user serial for that office ---
            counter_res = mongodb_service.get_user_counter(db_name=office_serial)
            if not ResponseManager.is_success(response=office_serial_res):
                flash(ResponseManager.get_error(response=office_serial_res), "danger")
                return office_serial_res
            office_serial = ResponseManager.get_data(response=office_serial_res)

            user_serial = counter_res["data"]

            new_user = {
                "user_serial": user_serial,
                "username": username,
                "password_hash": generate_password_hash(password),
                "email": email,
                "roles": roles,
                "office_name": office_name,
                "created_at": created_at
            }

            # --- Insert user into that tenant DB ---
            insert_res = mongodb_service.insert_one(
                db_name=office_serial,
                collection_name="users",
                document=new_user
            )

            if not insert_res["success"]:
                return ResponseManager.error(insert_res["error"])

            return ResponseManager.created("User added successfully")

        elif action == "edit":
            updates = {}
            if password:
                updates["password_hash"] = generate_password_hash(password)
            if email:
                updates["email"] = email
            if roles:
                updates["roles"] = roles

            if not updates:
                return ResponseManager.bad_request("No updates provided")

            office_serial = request.form.get("office_serial")
            if not office_serial:
                return ResponseManager.bad_request("Missing office serial")

            update_res = mongodb_service.update_fields(
                db_name=office_serial,
                collection_name="users",
                filters={"username": username},
                update_data=updates,
                operator="$set"
            )

            if not update_res["success"]:
                return ResponseManager.error(update_res["error"] or "Failed to edit user")

            return ResponseManager.success("User updated successfully")

        elif action == "delete":
            office_serial = request.form.get("office_serial")

            if not office_serial:
                return ResponseManager.bad_request("Missing office serial")

            delete_res = mongodb_service.delete_one(
                db_name=office_serial,
                collection_name="users",
                filters={"username": username},
            )

            if not delete_res["success"]:
                return ResponseManager.error(delete_res["error"] or "Failed to delete user")

            return ResponseManager.success(message="User deleted successfully")

        else:
            return ResponseManager.bad_request("Invalid action")

    except Exception as e:
        current_app.logger.error(f"❌ manage_user error: {e}")
        return ResponseManager.error(str(e))

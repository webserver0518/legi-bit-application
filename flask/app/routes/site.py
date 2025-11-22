# app/routes/site.py
from datetime import datetime
from flask import (
    Blueprint,
    render_template,
    redirect,
    url_for,
    session,
    flash,
    request,
    Response,
    current_app,
)
from werkzeug.security import check_password_hash
import uuid

from ..managers.response_management import ResponseManager
from ..managers.mfa_manager import MFAManager
from ..managers.auth_management import AuthenticationManager, AuthorizationManager


site_bp = Blueprint("site", __name__)


# ---------------- HEALTH ENDPOINT ---------------- #


@site_bp.route("/healthz")
def healthz():
    # current_app.logger.debug("Healthy")
    """
    current_app.logger.info("User logged in: %s")
    current_app.logger.warning("Request took too long")
    current_app.logger.error("Database connection failed")
    current_app.logger.critical("CRITICAL ERROR! SYSTEM DOWN!")
    """
    return "ok", 200


# ---------------- HELPERS ---------------- #

"""
@site_bp.route("/env")
def env():
    lines = [f"{k}={v}" for k, v in os.environ.items()]
    return Response('\n'.join(lines), mimetype="text/plain")
"""


@site_bp.route("/clearsession")
def clear_session():
    session.clear()
    return render_template("base_site.html")


# ---------------- SITE PAGES ---------------- #


@site_bp.route("/")
@site_bp.route("/home")
@site_bp.route("/about")
@AuthorizationManager.logout_required
def home():
    current_app.logger.debug("Home Page rendering")
    return render_template("base_site.html")


# ---------------- LOADERS ----------------


@site_bp.route("/load_login")
def load_login():
    current_app.logger.debug("Login Page rendering")
    return render_template("site_components/login.html")


@site_bp.route("/load_about")
def load_about():
    current_app.logger.debug("About Page rendering")
    return render_template("site_components/about.html")


@site_bp.route("/load_home")
def load_home():
    current_app.logger.debug("Home Page rendering")
    return render_template("site_components/home.html")


# ---------------- AUTH ROUTES ----------------


@site_bp.route("/login", methods=["POST"])
@AuthorizationManager.logout_required
def login():
    """
    JSON-only login endpoint with inline MFA.
    Returns ResponseManager responses exclusively.
    Flow:
      1) username+password → {success:true, data:{require_mfa:true}} if MFA enabled
      2) username+password+mfa_code (6 digits) → {success:true, data:{redirect:"/dashboard"}}
    """
    username = (request.form.get("username") or "").strip()
    password = (request.form.get("password") or "").strip()
    mfa_code = (request.form.get("mfa_code") or "").strip()

    if not username or not password:
        return ResponseManager.bad_request("Missing username or password")

    # 1) Verify credentials
    valid_login_res = AuthenticationManager.authenticate_login(username, password)
    if not ResponseManager.is_success(valid_login_res):
        return ResponseManager.unauthorized(
            ResponseManager.get_error(valid_login_res) or "Invalid credentials"
        )

    login_context = ResponseManager.get_data(valid_login_res) or {}
    user_doc = login_context.get("user") or {}
    user_doc.pop("password_hash", None)

    # 2) MFA gate (TOTP)
    mfa = user_doc.get("mfa") or {}
    mfa_enabled = mfa.get("status") == "enabled" and mfa.get("method") == "totp"

    if mfa_enabled and not (mfa_code.isdigit() and len(mfa_code) == 6):
        # Stage 1 complete: ask client to show MFA UI
        return ResponseManager.success(data={"require_mfa": True})

    if mfa_enabled:
        secret = mfa.get("secret") or ""
        if not MFAManager.verify_totp(secret, mfa_code):
            return ResponseManager.unauthorized("קוד MFA שגוי")

    # 3) Success → establish login context + cookie and return redirect url
    login_context["session_id"] = str(uuid.uuid4())
    AuthorizationManager.set_login_context(ctx=login_context)

    expires_at = datetime.utcnow() + current_app.permanent_session_lifetime
    resp, status = ResponseManager.success(data={"redirect": url_for("site.dashboard")})
    resp.set_cookie(
        "session_expires",
        str(int(expires_at.timestamp())),
        max_age=int(current_app.permanent_session_lifetime.total_seconds()),
        httponly=False,  # keep as in current app semantics
        samesite="Lax",
        path="/",
    )
    return resp, status


@site_bp.route("/login", methods=["GET"])
@AuthorizationManager.logout_required
def login_get():
    # Keep the loader-based flow so CSS/JS load correctly
    return redirect(url_for("site.load_login"))


@site_bp.route("/logout")
@AuthorizationManager.login_required
def logout():
    AuthorizationManager.logout()
    flash("Logged Out", "success")
    return redirect(url_for("site.home"))


@site_bp.route("/dashboard")
@AuthorizationManager.login_required
def dashboard():
    if AuthorizationManager.is_admin():
        return redirect(url_for("admin.base_admin_dashboard"))
    else:
        return redirect(url_for("user.base_user_dashboard"))

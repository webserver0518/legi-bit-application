# app/routes/site.py
from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, session, flash, request, Response, current_app
from werkzeug.security import check_password_hash
import uuid

from ..managers.response_management import ResponseManager
from ..managers.auth_management import AuthenticationManager, AuthorizationManager


site_bp = Blueprint('site', __name__)


# ---------------- HEALTH ENDPOINT ---------------- #

@site_bp.route("/healthz")
def healthz():
    #current_app.logger.debug("Healthy")
    """
    current_app.logger.info("User logged in: %s")
    current_app.logger.warning("Request took too long")
    current_app.logger.error("Database connection failed")
    current_app.logger.critical("CRITICAL ERROR! SYSTEM DOWN!")
    """
    if AuthorizationManager.is_logged_out():
        return "expired", 401
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
    return render_template('base_site.html')


# ---------------- SITE PAGES ---------------- #

@site_bp.route('/')
@site_bp.route('/home')
@site_bp.route('/about')
@AuthorizationManager.logout_required
def home():
    current_app.logger.debug("Home Page rendering")
    return render_template('base_site.html')


# ---------------- LOADERS ----------------

@site_bp.route('/load_login')
def load_login():
    current_app.logger.debug("Login Page rendering")
    return render_template('site_components/login.html')

@site_bp.route('/load_about')
def load_about():
    current_app.logger.debug("About Page rendering")
    return render_template('site_components/about.html')

@site_bp.route('/load_home')
def load_home():
    current_app.logger.debug("Home Page rendering")
    return render_template('site_components/home.html')


# ---------------- AUTH ROUTES ----------------

@site_bp.route('/login', methods=['GET', 'POST'])
@AuthorizationManager.logout_required
def login():
    try:
        current_app.logger.debug("Login function called")

        if request.method == 'POST':
            username = request.form['username'].strip()
            password = request.form['password'].strip()

            valid_login_res = AuthenticationManager.authenticate_login(username, password)

            if not ResponseManager.is_success(response=valid_login_res):
                flash(ResponseManager.get_error(response=valid_login_res), "danger")
                return redirect(url_for('site.home'))

            # logged in
            login_context = ResponseManager.get_data(response=valid_login_res)

            if user_context := login_context.get('user', None):
                user_context.pop('password_hash', None)
            login_context['session_id'] = str(uuid.uuid4())

            AuthorizationManager.set_login_context(ctx=login_context)

            expires_at = datetime.utcnow() + current_app.permanent_session_lifetime
            response = redirect(url_for('site.dashboard'))
            response.set_cookie(
                'session_expires',
                str(int(expires_at.timestamp())),
                max_age=int(current_app.permanent_session_lifetime.total_seconds()),
                httponly=False,   # חייב להיות False שה־JS יוכל לקרוא
                samesite='Lax',
                path='/'
            )

            return response


        # GET fallback → redirect home
        return redirect(url_for('site.load_login'))

    except Exception as e:
        current_app.logger.error(f"Login attempt failed")
        flash(f"Error in Login: {e}", "danger")
        return redirect(url_for('site.home'))

@site_bp.route('/logout')
@AuthorizationManager.login_required
def logout():
    AuthorizationManager.logout()
    flash("Logged Out", "success")
    return redirect(url_for('site.home'))

@site_bp.route('/dashboard')
@AuthorizationManager.login_required
def dashboard():
    if AuthorizationManager.is_admin():
        return redirect(url_for('admin.base_admin_dashboard'))
    else:
        return redirect(url_for('user.base_user_dashboard'))
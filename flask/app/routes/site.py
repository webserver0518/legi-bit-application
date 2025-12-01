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
from werkzeug.security import check_password_hash, generate_password_hash
import uuid
import random

from ..services import mongodb_service, ses_service
from ..managers.response_management import ResponseManager
from ..managers.mfa_manager import MFAManager
from ..managers.auth_management import AuthenticationManager, AuthorizationManager
from ..managers.rate_limiter import RateLimiter
from ..constants.constants_mongodb import MongoDBEntity, MongoDBFilters


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


@site_bp.route("/alb-health")
def alb_health():
    return {"status": "ok"}, 200


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


@site_bp.route("/send_email", methods=["POST"])
def send_email():
    data = request.json or {}
    to_email = data.get("to")
    subject = data.get("subject", "Legi-Bit Notification")
    message = data.get("message")

    if not to_email:
        return ResponseManager.bad_request(error="Missing destination email")

    if not subject:
        return ResponseManager.bad_request(error="Missing email subject")

    if not message:
        return ResponseManager.bad_request(error="Missing email message")

    ses_service.send_email(
        to_email=to_email,
        subject=subject,
        message=message,
    )

    return ResponseManager.success(message="Email sent successfully")


# ---------------- SITE PAGES ---------------- #


@site_bp.route("/")
@site_bp.route("/home")
@site_bp.route("/about")
@AuthorizationManager.logout_required
def home():
    #current_app.logger.debug("Home Page rendering")
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
@RateLimiter.limit(limit=5, window_seconds=60)
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

    recaptcha_token = request.form.get("recaptcha_token", "").strip()
    if not recaptcha_token:
        return ResponseManager.bad_request("Missing reCAPTCHA token")

    import requests
    verify_url = "https://www.google.com/recaptcha/api/siteverify"

    secret = current_app.config.get("RECAPTCHA_SECRET")
    site_key = current_app.config.get("RECAPTCHA_SITE_KEY")
    current_app.logger.debug(f"Verifying reCAPTCHA for user '{username}'")
    current_app.logger.debug(f"reCAPTCHA token: {recaptcha_token}")
    current_app.logger.debug(f"reCAPTCHA secret: {secret}")
    current_app.logger.debug(f"reCAPTCHA site key: {site_key}")
    current_app.logger.debug(f"reCAPTCHA verify URL: {verify_url}")
    resp = requests.post(verify_url, data={
        "secret": secret,
        "response": recaptcha_token
    }).json()

    if not resp.get("success"):
        current_app.logger.warning(
            f"reCAPTCHA failed for user '{username}' - error_codes: {resp.get('error-codes')} - hostname: {resp.get('hostname')}"
        )
        return ResponseManager.unauthorized("reCAPTCHA verification failed")

    score = resp.get("score")  # קיים רק ב-v3
    if score is not None and score < 0.3:
        current_app.logger.warning(
            f"reCAPTCHA blocked login for user '{username}' - score: {score} - action: {resp.get('action')}"
        )
        return ResponseManager.unauthorized("reCAPTCHA verification failed")

    if not username or not password:
        return ResponseManager.bad_request("Missing username or password")

    # 1) Verify credentials
    valid_login_res = AuthenticationManager.authenticate_login(username, password)
    if not ResponseManager.is_success(response=valid_login_res):
        return valid_login_res

    if ResponseManager.is_no_content(response=valid_login_res):
        return valid_login_res

    login_context = ResponseManager.get_data(valid_login_res)
    user_doc = login_context.get("user")
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


# ---------------- PASSWORD RECOVERY & USERNAME RECOVERY ROUTES ---------------- #

# הודעה גנרית לשחזור סיסמה – לא חושפת אם המשתמש קיים או לא
_GENERIC_RECOVERY_MSG = "אם הפרטים שמילאת תואמים משתמש במערכת, נשלח אליו קוד אימות."

# הודעה גנרית לשחזור שם משתמש – לא חושפת אם המשתמש קיים או לא
_GENERIC_USERNAME_RECOVERY_MSG = (
    "אם הפרטים שמילאת תואמים משתמש במערכת, שם המשתמש נשלח למייל."
)


def _get_office_serial_from_payload(payload: dict, required: bool = True):
    """
    Helper קטן לשימוש חוזר – מחלץ ומוודא קוד משרד מה־payload.

    מחזיר:
        (office_serial: int | None, error_response: tuple | None)
    """
    raw = (payload.get("office_code") or payload.get("office_serial") or "").strip()
    if not raw:
        if not required:
            return None, None
        return None, ResponseManager.bad_request("חסר קוד משרד")

    if not raw.isdigit():
        return None, ResponseManager.bad_request("קוד משרד חייב להיות מספר")

    return int(raw), None


def _match_recovery_user_by_office_and_username(office_serial: int, username: str):
    """
    Helper משותף לכל מסלולי שחזור הסיסמה.

    מחזיר:
        (user_doc, error_response, matched)

        * error_response != None  → להחזיר אותו ישירות מה־route
        * matched == False        → לא נמצא משתמש תואם (בלי לחשוף ללקוח)
    """

    username = (username or "").strip()
    if not username:
        return None, ResponseManager.bad_request("חסר שם משתמש"), False

    # שליפת המשתמש לפי שם משתמש (כמו בלוגין)
    user_res = mongodb_service.get_entity(
        entity=MongoDBEntity.USERS,
        filters=MongoDBFilters.User.by_username(username=username),
        limit=1,
    )
    if not ResponseManager.is_success(response=user_res):
        # תקלה במיקרו־סרוויס → מחזירים שגיאה ללקוח
        return None, user_res, False

    users = ResponseManager.get_data(response=user_res) or []
    if not users:
        current_app.logger.debug(
            f"password recovery: no user found for username='{username}'"
        )
        return None, None, False

    user_doc = users[0] or {}

    # חייב להיות office_serial כדי להמשיך
    user_office_serial = user_doc.get("office_serial")
    if user_office_serial is None:
        current_app.logger.warning(
            f"password recovery: user '{username}' missing office_serial"
        )
        return None, None, False

    # התאמת קוד משרד
    if office_serial is not None and int(user_office_serial) != int(office_serial):
        current_app.logger.debug(
            f"password recovery: office_serial mismatch for user='{username}' "
            f"(expected={office_serial}, actual={user_office_serial})"
        )
        return None, None, False

    return user_doc, None, True


@site_bp.route("/password/recovery/verify-user", methods=["POST"])
@AuthorizationManager.logout_required
@RateLimiter.limit(limit=20, window_seconds=600)
def password_recovery_verify_user():
    """
    שלב 0 (אופציונלי בפרונט): אימות התאמה בין קוד משרד לשם משתמש.

    בשונה משאר השלבים – כאן *כן* נחזיר שגיאה מפורשת,
    כדי לאפשר לממשק להציג כפתור ירוק/אדום כפי שתיארת.
    """
    payload = request.get_json(silent=True) or {}

    office_serial, error_response = _get_office_serial_from_payload(payload)
    if error_response is not None:
        return error_response

    username = (payload.get("username") or "").strip()
    if not username:
        return ResponseManager.bad_request("חסר שם משתמש")

    user_doc, error_response, matched = _match_recovery_user_by_office_and_username(
        office_serial=office_serial,
        username=username,
    )
    if error_response is not None:
        return error_response

    if not matched:
        return ResponseManager.unauthorized("לא נמצאה התאמה לקוד המשרד ולשם המשתמש")

    # נוודא שקיים אימייל לשלב הבא
    email = (user_doc.get("email") or "").strip()
    if not email:
        current_app.logger.warning(
            f"password recovery verify-user: user '{username}' "
            f"(office_serial={office_serial}) has no email configured"
        )
        return ResponseManager.error("לא מוגדר אימייל למשתמש, פנה למנהל המערכת")

    return ResponseManager.success(
        message="פרטי המשרד והמשתמש אומתו בהצלחה, ניתן לשלוח קוד למייל."
    )


@site_bp.route("/password/recovery/send-code", methods=["POST"])
@AuthorizationManager.logout_required
@RateLimiter.limit(limit=5, window_seconds=300)
def password_recovery_send_code():
    """
    שלב 1: קבלת קוד משרד + משתמש, ולשלוח קוד אימות למייל.

    לא חושף האם המשתמש קיים – תמיד מחזיר הודעה גנרית.
    """
    payload = request.get_json(silent=True) or {}

    office_serial, error_response = _get_office_serial_from_payload(payload)
    if error_response is not None:
        return error_response

    username = (payload.get("username") or "").strip()

    if not username:
        return ResponseManager.bad_request("חסר שם משתמש")

    user_doc, error_response, matched = _match_recovery_user_by_office_and_username(
        office_serial=office_serial,
        username=username,
    )
    if error_response is not None:
        return error_response

    if not matched:
        # לא חושפים אם הפרטים לא תואמים
        return ResponseManager.success(message=_GENERIC_RECOVERY_MSG)

    user_email = (user_doc.get("email") or "").strip()
    if not user_email:
        current_app.logger.warning(
            f"password recovery: user '{username}' "
            f"(office_serial={office_serial}) has no email configured"
        )
        # גם כאן נשמור על הודעה גנרית
        return ResponseManager.success(message=_GENERIC_RECOVERY_MSG)

    office_serial = user_doc.get("office_serial")
    user_serial = user_doc.get("serial")
    if office_serial is None or user_serial is None:
        current_app.logger.warning(
            f"password recovery: missing office_serial/serial for user='{username}'"
        )
        return ResponseManager.error("שגיאת שרת בעת הכנת איפוס סיסמא")

    # יצירת קוד בן 6 ספרות
    code = f"{random.randint(0, 999999):06d}"

    recovery_doc = {
        "password_recovery": {
            "code": code,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
    }

    up_res = mongodb_service.update_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(user_serial)),
        update_data=recovery_doc,
        multiple=False,
        operator="$set",
    )
    if not ResponseManager.is_success(response=up_res):
        return up_res

    # שליחת מייל עם הקוד
    subject = "קוד לאיפוס סיסמא - Legi-Bit"
    message = (
        "קוד האימות שלך לאיפוס הסיסמא במערכת Legi-Bit הוא: "
        f"{code}\n"
        "הקוד תקף לזמן מוגבל, אנא אל תשתף אותו עם אחרים."
    )
    ses_service.send_email(to_email=user_email, subject=subject, message=message)

    current_app.logger.debug(
        f"password recovery: generated code '{code}' for user='{username}' "
        f"(office_serial={office_serial}, user_serial={user_serial})"
    )

    return ResponseManager.success(
        message=_GENERIC_RECOVERY_MSG,
        data={"sent": True},
    )


@site_bp.route("/password/recovery/verify-code", methods=["POST"])
@AuthorizationManager.logout_required
@RateLimiter.limit(limit=10, window_seconds=600)
def password_recovery_verify_code():
    """
    שלב 2: אימות קוד האימות שהוזן ע"י המשתמש.
    אם הקוד או הפרטים לא תקינים → Unauthorized עם הודעה גנרית.
    """
    payload = request.get_json(silent=True) or {}

    office_serial, error_response = _get_office_serial_from_payload(payload)
    if error_response is not None:
        return error_response

    username = (payload.get("username") or "").strip()
    code = (payload.get("code") or "").strip()

    if not username or not code:
        return ResponseManager.bad_request("חסרים פרטים לאימות הקוד")

    if not code.isdigit() or len(code) != 6:
        return ResponseManager.bad_request("קוד אימות חייב להכיל 6 ספרות")

    user_doc, error_response, matched = _match_recovery_user_by_office_and_username(
        office_serial=office_serial,
        username=username,
    )
    if error_response is not None:
        return error_response

    if not matched:
        return ResponseManager.unauthorized("קוד אימות שגוי או פג תוקף")

    recovery = user_doc.get("password_recovery") or {}
    stored_code = (recovery.get("code") or "").strip()

    if stored_code != code:
        return ResponseManager.unauthorized("קוד אימות שגוי או פג תוקף")

    # כרגע רק מאשרים – ה־JS ישתמש בזה כדי לפתוח את שדה הסיסמא
    return ResponseManager.success(message="קוד אומת בהצלחה")


@site_bp.route("/password/recovery/reset", methods=["POST"])
@AuthorizationManager.logout_required
def password_recovery_reset():
    """
    שלב 3: קבלת סיסמה חדשה + הקוד, ואיפוס הסיסמה בפועל.
    """
    payload = request.get_json(silent=True) or {}

    office_serial, error_response = _get_office_serial_from_payload(payload)
    if error_response is not None:
        return error_response

    username = (payload.get("username") or "").strip()
    code = (payload.get("code") or "").strip()
    new_password = (payload.get("new_password") or "").strip()

    if not username or not code or not new_password:
        return ResponseManager.bad_request("חסרים פרטים לאיפוס הסיסמא")

    if len(new_password) < 6:
        # תוכל לחזק את המדיניות כאן
        return ResponseManager.bad_request("הסיסמא החדשה צריכה להכיל לפחות 6 תווים")

    if not code.isdigit() or len(code) != 6:
        return ResponseManager.bad_request("קוד אימות חייב להכיל 6 ספרות")

    user_doc, error_response, matched = _match_recovery_user_by_office_and_username(
        office_serial=office_serial,
        username=username,
    )
    if error_response is not None:
        return error_response

    if not matched:
        return ResponseManager.unauthorized("קוד אימות שגוי או פג תוקף")

    recovery = user_doc.get("password_recovery") or {}
    stored_code = (recovery.get("code") or "").strip()
    if stored_code != code:
        return ResponseManager.unauthorized("קוד אימות שגוי או פג תוקף")

    office_serial = user_doc.get("office_serial")
    user_serial = user_doc.get("serial")
    if office_serial is None or user_serial is None:
        current_app.logger.warning(
            f"password reset: missing office_serial/serial for user='{username}'"
        )
        return ResponseManager.error("שגיאת שרת בעת איפוס הסיסמא")

    new_hash = generate_password_hash(new_password)

    update_data = {
        "password_hash": new_hash,
        "password_recovery": None,  # מנקים את מצב השחזור
        "password_changed_at": datetime.utcnow().isoformat() + "Z",
    }

    up_res = mongodb_service.update_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters=MongoDBFilters.by_serial(int(user_serial)),
        update_data=update_data,
        multiple=False,
        operator="$set",
    )
    if not ResponseManager.is_success(response=up_res):
        return up_res

    current_app.logger.info(
        f"password reset completed for user='{username}' "
        f"(office_serial={office_serial}, user_serial={user_serial})"
    )

    return ResponseManager.success(message="הסיסמא אופסה בהצלחה")


@site_bp.route("/username/recovery/send-username", methods=["POST"])
@AuthorizationManager.logout_required
@RateLimiter.limit(limit=5, window_seconds=300)
def username_recovery_send_username():
    """
    שחזור שם משתמש:
    קבלת קוד משרד + אימייל, ואם יש משתמש תואם – נשלח את שם המשתמש למייל.

    שים לב: ההודעה ללקוח תמיד גנרית, כדי לא לחשוף האם המשתמש קיים.
    """
    payload = request.get_json(silent=True) or {}

    office_serial, error_response = _get_office_serial_from_payload(payload)
    if error_response is not None:
        return error_response

    email = (payload.get("email") or "").strip()
    if not email:
        return ResponseManager.bad_request("חסר אימייל")

    # חיפוש משתמש לפי office_serial + email
    user_res = mongodb_service.get_entity(
        entity=MongoDBEntity.USERS,
        office_serial=office_serial,
        filters={"email": email},
        limit=1,
    )
    if not ResponseManager.is_success(response=user_res):
        return user_res

    users = ResponseManager.get_data(response=user_res) or []
    if not users:
        # לא חושפים אם לא נמצא – עדיין מחזירים success עם הודעה גנרית
        return ResponseManager.success(
            message=_GENERIC_USERNAME_RECOVERY_MSG,
            data={"sent": False},
        )

    user_doc = users[0] or {}
    username = (user_doc.get("username") or "").strip()
    user_email = (user_doc.get("email") or "").strip()

    if not username or not user_email:
        # גם כאן – הודעה גנרית ללקוח, אבל נרשום אזהרה בלוג
        current_app.logger.warning(
            f"username recovery: missing username/email for office_serial={office_serial}"
        )
        return ResponseManager.success(
            message=_GENERIC_USERNAME_RECOVERY_MSG,
            data={"sent": False},
        )

    subject = "שחזור שם משתמש - Legi-Bit"
    message = (
        "שלום,\n\n"
        "שם המשתמש שלך למערכת Legi-Bit הוא:\n"
        f"{username}\n\n"
        "אם לא ביקשת שחזור שם משתמש, ניתן להתעלם מהודעה זו."
    )
    ses_service.send_email(to_email=user_email, subject=subject, message=message)

    current_app.logger.info(
        f"username recovery: sent username to '{user_email}' "
        f"(office_serial={office_serial}, username='{username}')"
    )

    return ResponseManager.success(
        message=_GENERIC_USERNAME_RECOVERY_MSG,
        data={"sent": True},
    )

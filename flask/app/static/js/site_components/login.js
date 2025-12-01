// login.js — Inline MFA with ResponseManager + Loader.init hook

window.init_login = function () {
    // Elements
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('login-submit');
    const userInput = form?.querySelector('[name="username"]');
    const passInput = form?.querySelector('[name="password"]');

    const mfaBlock = document.getElementById('mfa-block'); // hidden by default
    const mfaInput = document.getElementById('mfa_code');
    const mfaBtn = document.getElementById('mfa-submit');

    // Helpers
    const setBusy = (btn, busy) => { if (btn) btn.disabled = !!busy; };

    const revealMfa = () => {
        if (!mfaBlock) return;
        mfaBlock.hidden = false;
        if (userInput) { userInput.readOnly = true; userInput.classList.add('disabled'); }
        if (passInput) { passInput.readOnly = true; passInput.classList.add('disabled'); }
        if (loginBtn) loginBtn.disabled = true;
        mfaInput?.focus();
    };

    // Core request via your API helper (ResponseManager schema)
    async function postLogin(withMfa) {
        if (!form) return;

        const fd = new FormData(form);

        const token = await getRecaptchaToken(withMfa ? "mfa" : "login");
        if (!token) {
            window.Toast?.danger?.("reCAPTCHA לא נטען. רענן את הדף ונסה שוב.");
            setBusy(withMfa ? mfaBtn : loginBtn, false);
            return;
        }
        fd.set("recaptcha_token", token);

        if (withMfa) {
            const code = (mfaInput?.value || '').trim();
            if (!/^\d{6}$/.test(code)) {
                window.Toast?.warning?.('נא להזין קוד MFA בן 6 ספרות.');
                return;
            }
            fd.set('mfa_code', code);
        } else {
            fd.delete('mfa_code');
        }

        setBusy(withMfa ? mfaBtn : loginBtn, true);

        // אם יש לך window.API.apiRequest – נשתמש בו; אחרת ניפול ל-fetch רגיל
        let res;
        try {
            if (window.API?.apiRequest) {
                res = await window.API.apiRequest('/login', {
                    method: 'POST',
                    headers: { 'X-Login-JSON': '1' }, // לא חובה, השרת ממילא מחזיר JSON
                    body: fd
                });
            } else {
                const r = await fetch('/login', { method: 'POST', body: fd });
                res = await r.json();
            }
        } catch (err) {
            setBusy(withMfa ? mfaBtn : loginBtn, false);
            window.Toast?.danger?.('שגיאת רשת. נסה שוב.');
            return;
        }

        setBusy(withMfa ? mfaBtn : loginBtn, false);

        if (!res?.success) {
            window.Toast?.danger?.(res?.error || res?.message || 'שגיאת התחברות');
            return;
        }

        const data = res.data || {};

        // שלב 1 → השרת מבקש MFA
        if (data.require_mfa) {
            // חיווי שבוצעה בדיקת שם משתמש/סיסמה בהצלחה
            window.Toast?.success?.('שם משתמש וסיסמה תקינים. הזן קוד אימות דו־שלבי.');
            revealMfa();
            return;
        }

        // שלב 2 או התחברות ללא MFA → נווט
        if (data.redirect) {
            window.location.href = data.redirect;
            return;
        }

        // ברירת מחדל
        window.Toast?.success?.(res.message || 'התחברת בהצלחה');
    }

    // Stage 1: username+password
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!userInput?.value || !passInput?.value) {
            window.Toast?.warning?.('נא למלא שם משתמש וסיסמה.');
            return;
        }

        const token = await getRecaptchaToken("login");
        document.getElementById("recaptcha_token").value = token;

        postLogin(false);
    }, { capture: true });

    // Stage 2: MFA verify
    mfaInput?.addEventListener('input', async () => {
        const val = mfaInput.value.trim();
        if (/^\d{6}$/.test(val)) {

            const token = await getRecaptchaToken("mfa");
            document.getElementById("recaptcha_token").value = token;

            postLogin(true);
        }
    });


    // -----------------------------
    // Forgot password – recovery flow
    // -----------------------------
    const forgotPasswordLink = document.getElementById('forgot-password');
    const recoveryModal = document.getElementById('recovery-modal');
    const recoveryCloseBtn = document.getElementById('recovery-close');
    const recoveryForm = document.getElementById('recovery-form');

    const recoveryOfficeInput = document.getElementById('recovery-office');
    const recoveryUsernameInput = document.getElementById('recovery-username');
    const recoveryVerifyBtn = document.getElementById('recovery-verify-user');
    const recoverySendCodeBtn = document.getElementById('recovery-send-code');
    const recoveryCodeInput = document.getElementById('recovery-code');
    const recoveryNewPassInput = document.getElementById('recovery-new-password');
    const recoveryTogglePassBtn = document.getElementById('recovery-toggle-password');
    const recoverySubmitBtn = document.getElementById('recovery-submit');

    let recoveryIdentityVerified = false;
    let recoveryCodeVerified = false;

    // payload בסיסי – קוד משרד + שם משתמש
    const getRecoveryPayload = () => ({
        office_code: (recoveryOfficeInput?.value || '').trim(),
        username: (recoveryUsernameInput?.value || '').trim(),
    });

    // איפוס כל ה-UI של איפוס סיסמה
    const resetRecoveryUI = () => {
        if (recoveryOfficeInput) {
            recoveryOfficeInput.value = '';
            recoveryOfficeInput.readOnly = false;
            recoveryOfficeInput.classList.remove('disabled');
        }
        if (recoveryUsernameInput) {
            recoveryUsernameInput.value = '';
            recoveryUsernameInput.readOnly = false;
            recoveryUsernameInput.classList.remove('disabled');
        }
        if (recoveryCodeInput) {
            recoveryCodeInput.value = '';
            recoveryCodeInput.disabled = true;
        }
        if (recoveryNewPassInput) {
            recoveryNewPassInput.value = '';
            recoveryNewPassInput.disabled = true;
        }
        if (recoverySubmitBtn) {
            recoverySubmitBtn.disabled = true;
        }
        if (recoverySendCodeBtn) {
            recoverySendCodeBtn.disabled = true;
        }
        if (recoveryVerifyBtn) {
            recoveryVerifyBtn.disabled = false;
            recoveryVerifyBtn.classList.remove('btn-success', 'btn-danger');
        }

        recoveryIdentityVerified = false;
        recoveryCodeVerified = false;
    };

    const syncRecoveryToggleState = () => {
        if (!recoveryTogglePassBtn || !recoveryNewPassInput) return;

        const disabled = !!recoveryNewPassInput.disabled;
        recoveryTogglePassBtn.disabled = disabled;

        // אם ננעל/נכבה את השדה – נחזיר למצב מוסתר
        if (disabled) {
            recoveryNewPassInput.type = 'password';
            recoveryTogglePassBtn.setAttribute('aria-pressed', 'false');
            recoveryTogglePassBtn.classList.remove('is-on');
        }
    };

    recoveryTogglePassBtn?.addEventListener('click', () => {
        if (!recoveryNewPassInput || recoveryNewPassInput.disabled) return;

        const show = (recoveryNewPassInput.type === 'password');
        recoveryNewPassInput.type = show ? 'text' : 'password';

        recoveryTogglePassBtn.setAttribute('aria-pressed', String(show));
        recoveryTogglePassBtn.classList.toggle('is-on', show);

        // נחמד: להשאיר פוקוס וקורסור בסוף
        recoveryNewPassInput.focus();
        const v = recoveryNewPassInput.value || '';
        recoveryNewPassInput.setSelectionRange?.(v.length, v.length);
    });


    const openRecoveryModal = () => {
        if (!recoveryModal) return;
        resetRecoveryUI();
        syncRecoveryToggleState();
        recoveryModal.hidden = false;
        recoveryOfficeInput?.focus();
    };

    const closeRecoveryModal = () => {
        if (!recoveryModal) return;
        recoveryModal.hidden = true;
    };

    // ולידציה לשלב זיהוי (קוד משרד + שם משתמש)
    const validateIdentityFields = () => {
        const { office_code, username } = getRecoveryPayload();
        if (!office_code || !username) {
            window.Toast?.warning?.('נא למלא קוד משרד ושם משתמש.');
            return false;
        }
        if (!/^\d+$/.test(office_code)) {
            window.Toast?.warning?.('קוד משרד חייב להיות מספרי בלבד.');
            recoveryOfficeInput?.focus();
            return false;
        }
        return true;
    };

    // צבע של כפתור אימות (אפור / ירוק / אדום)
    const setVerifyState = (state) => {
        if (!recoveryVerifyBtn) return;
        recoveryVerifyBtn.classList.remove('btn-success', 'btn-danger');
        if (state === 'ok') {
            recoveryVerifyBtn.classList.add('btn-success');
        } else if (state === 'error') {
            recoveryVerifyBtn.classList.add('btn-danger');
        }
    };

    // שלב 0 – אימות קוד משרד + שם משתמש (כפתור הופך ירוק / אדום)
    const handleVerifyUser = async () => {
        if (!validateIdentityFields()) return;
        if (!recoveryVerifyBtn) return;

        const token = await getRecaptchaToken("recovery");
        document.getElementById("recaptcha_token").value = token;

        const payload = getRecoveryPayload();

        try {
            setBusy(recoveryVerifyBtn, true);
            setVerifyState(null);

            const res = await window.API.postJson('/password/recovery/verify-user', payload);

            if (!res.success) {
                const msg = res.message || res.error || 'אימות הפרטים נכשל.';
                window.Toast?.warning?.(msg);

                resetRecoveryUI();
                setVerifyState('error');
                recoveryOfficeInput?.focus();
                return;
            }

            // הצלחה – נועלים שדות, מפעילים שליחת קוד, כפתור ירוק
            recoveryIdentityVerified = true;
            setVerifyState('ok');

            if (recoveryOfficeInput) recoveryOfficeInput.readOnly = true;
            if (recoveryUsernameInput) recoveryUsernameInput.readOnly = true;

            if (recoverySendCodeBtn) recoverySendCodeBtn.disabled = false;
            if (recoveryCodeInput) recoveryCodeInput.disabled = false;

            window.Toast?.success?.(
                res.message || 'הפרטים אומתו בהצלחה, ניתן לשלוח קוד למייל.'
            );
        } catch (err) {
            window.Toast?.danger?.('שגיאת רשת בעת אימות הפרטים.');
        } finally {
            setBusy(recoveryVerifyBtn, false);
        }
    };

    // שלב 1 – שליחת קוד למייל
    const handleSendCode = async () => {
        const token = await getRecaptchaToken("recovery");
        document.getElementById("recaptcha_token").value = token;

        if (!recoveryIdentityVerified) {
            window.Toast?.warning?.('קודם יש לאמת את קוד המשרד ושם המשתמש.');
            return;
        }
        if (!recoverySendCodeBtn) return;

        const payload = getRecoveryPayload();

        try {
            setBusy(recoverySendCodeBtn, true);
            const res = await window.API.postJson('/password/recovery/send-code', payload);

            if (!res.success) {
                const msg = res.message || res.error || 'שליחת קוד האימות נכשלה.';
                return window.Toast?.warning?.(msg);
            }

            const msg =
                res.message ||
                'אם הפרטים שמילאת תואמים משתמש במערכת, נשלח אליו קוד אימות למייל.';
            window.Toast?.info?.(msg);

            if (recoveryCodeInput) {
                recoveryCodeInput.disabled = false;
                recoveryCodeInput.focus();
            }
        } finally {
            setBusy(recoverySendCodeBtn, false);
        }
    };

    // שלב 2 – אימות קוד (מתקרא אוטומטית כשיש 6 ספרות)
    const handleVerifyCode = async () => {
        if (!recoveryIdentityVerified) {
            window.Toast?.warning?.('קודם יש לאמת את פרטי המשרד והמשתמש.');
            return;
        }

        const code = (recoveryCodeInput?.value || '').trim();
        if (!/^\d{6}$/.test(code)) {
            window.Toast?.warning?.('קוד אימות חייב להכיל 6 ספרות.');
            return;
        }

        const payload = {
            ...getRecoveryPayload(),
            code,
        };

        try {
            const res = await window.API.postJson('/password/recovery/verify-code', payload);

            if (!res.success) {
                const msg = res.message || res.error || 'קוד אימות שגוי או פג תוקף.';
                window.Toast?.warning?.(msg);

                recoveryCodeVerified = false;
                if (recoveryNewPassInput) recoveryNewPassInput.disabled = true;
                if (recoverySubmitBtn) recoverySubmitBtn.disabled = true;
                return;
            }

            recoveryCodeVerified = true;
            if (recoveryNewPassInput) recoveryNewPassInput.disabled = false;
            if (recoverySubmitBtn) recoverySubmitBtn.disabled = false;
            syncRecoveryToggleState();

            window.Toast?.success?.(
                res.message || 'הקוד אומת בהצלחה, ניתן לבחור סיסמא חדשה.'
            );
        } catch (err) {
            window.Toast?.danger?.('שגיאת רשת בעת אימות הקוד.');
        }
    };

    // שלב 3 – איפוס סיסמה בפועל
    const handleRecoverySubmit = async (e) => {
        e?.preventDefault?.();
        if (!recoveryIdentityVerified || !recoveryCodeVerified) {
            window.Toast?.warning?.('נא להשלים את כל שלבי האימות לפני איפוס הסיסמא.');
            return;
        }

        const code = (recoveryCodeInput?.value || '').trim();
        const newPassword = (recoveryNewPassInput?.value || '').trim();

        if (!/^\d{6}$/.test(code)) {
            window.Toast?.warning?.('קוד אימות חייב להכיל 6 ספרות.');
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            window.Toast?.warning?.('הסיסמא החדשה צריכה להכיל לפחות 6 תווים.');
            return;
        }

        const payload = {
            ...getRecoveryPayload(),
            code,
            new_password: newPassword,
        };

        try {
            if (recoverySubmitBtn) setBusy(recoverySubmitBtn, true);

            const res = await window.API.postJson('/password/recovery/reset', payload);
            if (!res.success) {
                const msg = res.message || res.error || 'איפוס הסיסמא נכשל.';
                return window.Toast?.warning?.(msg);
            }

            window.Toast?.success?.(
                res.message || 'הסיסמא אופסה בהצלחה, אפשר להתחבר עם הסיסמא החדשה.'
            );

            // למלא אוטומטית את שם המשתמש במסך הלוגין
            if (userInput && recoveryUsernameInput?.value) {
                userInput.value = recoveryUsernameInput.value;
            }

            closeRecoveryModal();
        } finally {
            if (recoverySubmitBtn) setBusy(recoverySubmitBtn, false);
        }
    };

    // --- אירועים של איפוס סיסמה ---

    forgotPasswordLink?.addEventListener('click', (ev) => {
        ev.preventDefault();
        openRecoveryModal();
    });

    recoveryCloseBtn?.addEventListener('click', (ev) => {
        ev.preventDefault();
        closeRecoveryModal();
    });

    recoveryVerifyBtn?.addEventListener('click', (ev) => {
        ev.preventDefault();
        handleVerifyUser();
    });

    recoverySendCodeBtn?.addEventListener('click', (ev) => {
        ev.preventDefault();
        handleSendCode();
    });

    recoveryCodeInput?.addEventListener('input', () => {
        if (!recoveryCodeInput) return;

        // השמת ספרות בלבד, עד 6
        recoveryCodeInput.value = recoveryCodeInput.value.replace(/\D+/g, '').slice(0, 6);

        if (/^\d{6}$/.test(recoveryCodeInput.value)) {
            handleVerifyCode();
        } else {
            recoveryCodeVerified = false;
            if (recoveryNewPassInput) recoveryNewPassInput.disabled = true;
            if (recoverySubmitBtn) recoverySubmitBtn.disabled = true;

            syncRecoveryToggleState();
        }
    });

    recoveryForm?.addEventListener('submit', handleRecoverySubmit);

    // -----------------------------
    // Username recovery – forgot username
    // -----------------------------
    const forgotUsernameLink = document.getElementById('forgot-username');
    const usernameRecoveryModal = document.getElementById('username-recovery-modal');
    const usernameRecoveryCloseBtn = document.getElementById('username-recovery-close');
    const usernameRecoveryForm = document.getElementById('username-recovery-form');
    const usernameRecoveryOfficeInput = document.getElementById('username-recovery-office');
    const usernameRecoveryEmailInput = document.getElementById('username-recovery-email');
    const usernameRecoverySubmitBtn = document.getElementById('username-recovery-submit');

    const resetUsernameRecoveryUI = () => {
        if (usernameRecoveryOfficeInput) usernameRecoveryOfficeInput.value = '';
        if (usernameRecoveryEmailInput) usernameRecoveryEmailInput.value = '';
    };

    const openUsernameRecoveryModal = () => {
        if (!usernameRecoveryModal) return;
        resetUsernameRecoveryUI();
        usernameRecoveryModal.hidden = false;
        usernameRecoveryOfficeInput?.focus();
    };

    const closeUsernameRecoveryModal = () => {
        if (!usernameRecoveryModal) return;
        usernameRecoveryModal.hidden = true;
    };

    const handleUsernameRecoverySubmit = async (e) => {
        e?.preventDefault?.();

        const token = await getRecaptchaToken("username_recovery");
        document.getElementById("recaptcha_token").value = token;

        const officeCode = (usernameRecoveryOfficeInput?.value || '').trim();
        const email = (usernameRecoveryEmailInput?.value || '').trim();

        if (!officeCode || !email) {
            window.Toast?.warning?.('נא למלא קוד משרד ואימייל.');
            return;
        }

        if (!/^\d+$/.test(officeCode)) {
            window.Toast?.warning?.('קוד משרד חייב להיות מספרי בלבד.');
            usernameRecoveryOfficeInput?.focus();
            return;
        }

        const payload = {
            office_code: officeCode,
            email,
        };

        try {
            if (usernameRecoverySubmitBtn) setBusy(usernameRecoverySubmitBtn, true);

            const res = await window.API.postJson('/username/recovery/send-username', payload);

            if (!res.success) {
                const msg = res.message || res.error || 'שחזור שם המשתמש נכשל.';
                return window.Toast?.warning?.(msg);
            }

            // השרת מחזיר הודעה גנרית – לא חושפים אם המשתמש קיים
            window.Toast?.info?.(
                res.message || 'אם הפרטים תואמים משתמש במערכת, שם המשתמש נשלח למייל.'
            );

            closeUsernameRecoveryModal();
        } finally {
            if (usernameRecoverySubmitBtn) setBusy(usernameRecoverySubmitBtn, false);
        }
    };

    // אירועים של שחזור שם משתמש
    forgotUsernameLink?.addEventListener('click', (e) => {
        e.preventDefault();
        openUsernameRecoveryModal();
    });

    usernameRecoveryCloseBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeUsernameRecoveryModal();
    });

    usernameRecoveryForm?.addEventListener('submit', handleUsernameRecoverySubmit);
};


function getRecaptchaSiteKey() {
    return window.__RECAPTCHA_SITE_KEY || "";
}

async function waitForGrecaptcha(timeoutMs = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (window.grecaptcha?.execute && window.grecaptcha?.ready) return true;
        await new Promise(r => setTimeout(r, 50));
    }
    return false;
}

async function getRecaptchaToken(action = "login") {
    const siteKey = getRecaptchaSiteKey();
    if (!siteKey) return "";

    const ok = await waitForGrecaptcha();
    if (!ok) return "";

    await new Promise(resolve => grecaptcha.ready(resolve));
    return await grecaptcha.execute(siteKey, { action });
}
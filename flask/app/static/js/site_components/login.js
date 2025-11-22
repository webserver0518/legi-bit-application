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
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!userInput?.value || !passInput?.value) {
            window.Toast?.warning?.('נא למלא שם משתמש וסיסמה.');
            return;
        }
        postLogin(false);
    }, { capture: true });

    // Stage 2: MFA verify
    mfaBtn?.addEventListener('click', () => postLogin(true));
    mfaInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') mfaBtn.click(); });
};

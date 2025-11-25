// user_mfa.js (minimal, no deps)
(function () {
    "use strict";

    // --- Elements ---
    const el = {
        page: document.getElementById("user-mfa-page"),

        // Sections
        enrollSection: document.getElementById("mfa-enroll-section"),
        resetSection: document.getElementById("mfa-reset-section"),

        // Enroll
        enrollStart: document.getElementById("mfa-enroll-start"),
        panel: document.getElementById("mfa-enroll-panel"),
        qr: document.getElementById("mfa-qr-image"),
        secret: document.getElementById("mfa-secret"),
        code: document.getElementById("mfa-code"),
        verifyBtn: document.getElementById("mfa-enroll-verify"),
        cancelBtn: document.getElementById("mfa-enroll-cancel"),

        // Reset
        resetForm: document.getElementById("mfa-reset-form"),
        resetPassword: document.getElementById("mfa-reset-password"),
    };

    if (!el.page) return; // page not present

    // --- Small helpers ---
    function show(node) { if (node) node.hidden = false; }
    function hide(node) { if (node) node.hidden = true; }
    function setQR(src) { if (el.qr) el.qr.src = src || ""; }
    function setSecret(v) { if (el.secret) el.secret.value = v || ""; }

    async function apiPost(url, payload = {}) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        });
        // tolerate non-JSON errors
        let data = null;
        try { data = await res.json(); } catch { /* ignore */ }
        return { ok: res.ok, status: res.status, json: data };
    }

    // --- Enroll: start ---
    async function handleStartEnroll() {
        // Ask server to create a new TOTP secret and QR
        const { ok, json } = await apiPost("/user/mfa/enroll", {});
        if (!ok || !json?.success) {
            const msg = json?.message || json?.error || "נכשלה יצירת ה-MFA. נסה/י שוב.";
            return window.Toast.warning(msg);
        }

        const { secret, otpauth_uri, qr_image } = json.data || {};
        // Expect qr_image: data:image/png;base64,...
        setSecret(secret || "");
        setQR(qr_image || "");

        // show panel
        show(el.panel);

        // (Optional) If you want to expose the full URI in minimal page:
        // You can add an element to show otpauth_uri later if needed.
        console.log("otpauth_uri:", otpauth_uri);
    }

    // --- Enroll: verify first code ---
    async function handleVerifyEnroll() {
        const code = (el.code?.value || "").trim();
        if (!/^\d{6}$/.test(code)) {
            return window.Toast.warning("נא להזין קוד בן 6 ספרות.");
        }

        const { ok, json } = await apiPost("/user/mfa/verify-enroll", { code });
        if (!ok || !json?.success) {
            const msg = json?.message || json?.error || "האימות נכשל. ודא/י את השעה במכשיר והקוד נסי/ה שוב.";
            return window.Toast.warning(msg);
        }

        return window.Toast.success("ה-MFA הופעל בהצלחה!");
        // clean & collapse panel
        setSecret("");
        setQR("");
        if (el.code) el.code.value = "";
        hide(el.panel);
    }

    // --- Enroll: cancel ---
    function handleCancelEnroll() {
        setSecret("");
        setQR("");
        if (el.code) el.code.value = "";
        hide(el.panel);
    }

    // --- Reset MFA ---
    async function handleResetSubmit(e) {
        e.preventDefault();
        const password = (el.resetPassword?.value || "").trim();

        const { ok, json } = await apiPost("/user/mfa/reset", { password });
        if (!ok || !json?.success) {
            const msg = json?.message || json?.error || "איפוס ה-MFA נכשל.";
            return window.Toast.warning(msg);
        }


        window.Toast.success("ה-MFA אופס בהצלחה.");
        // Clear UI just in case
        handleCancelEnroll();
        if (el.resetPassword) el.resetPassword.value = "";
    }

    // --- Wire events ---
    el.enrollStart?.addEventListener("click", handleStartEnroll);
    el.cancelBtn?.addEventListener("click", handleCancelEnroll);
    el.resetForm?.addEventListener("submit", handleResetSubmit);

    // Auto-submit MFA code when 6 digits typed
    el.code?.addEventListener("input", () => {
        el.code.value = el.code.value.replace(/\D+/g, "").slice(0, 6);

        if (/^\d{6}$/.test(el.code.value)) {
            handleVerifyEnroll(); // ← שולח אוטומטית
        }
    });

    // --- Optional: restrict input to digits only ---
    el.code?.addEventListener("input", () => {
        el.code.value = el.code.value.replace(/\D+/g, "").slice(0, 6);
    });
})();

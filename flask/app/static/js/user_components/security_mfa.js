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

    async function fetchStatus() {
        const res = await window.API.getJson("/user/mfa/status");
        if (!res?.success) {
            return { status: null, hasMfa: false, isPending: false };
        }

        const mfa = res.data?.mfa || null;
        const status = mfa?.status || null;

        const isPending = status === "pending";
        const hasMfa = status === "enabled";

        return { status, hasMfa, isPending };
    }

    function applyVisibility(hasMfa) {
        if (hasMfa) {
            hide(el.enrollSection);
            show(el.resetSection);
        } else {
            hide(el.resetSection);
            show(el.enrollSection);
        }
        show(el.page); // B: מציגים רק אחרי החלטה
    }

    async function loadStatusAndApply() {
        hide(el.page);
        hide(el.panel);
        const { hasMfa } = await fetchStatus();
        applyVisibility(hasMfa);
    }

    // --- Enroll: start ---
    async function handleStartEnroll() {
        // Ask server to create a new TOTP secret and QR
        const res = await window.API.postJson("/user/mfa/enroll", {});
        if (!res.success) {
            const msg = res.message || res.error || "נכשלה יצירת קוד לאימות דו-שלבי";
            return window.Toast.warning(msg);
        }
        const { secret, otpauth_uri, qr_image } = res.data || {};

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

        const res = await window.API.postJson("/user/mfa/verify-enroll", { code });
        if (!res.success) {
            const msg = res.message || res.error || "האימות נכשל. ודא/י את השעה במכשיר והקוד נסי/ה שוב.";
            return window.Toast.warning(msg);
        }

        window.Toast.success("ה-MFA הופעל בהצלחה!");
        // clean & collapse panel
        setSecret("");
        setQR("");
        if (el.code) el.code.value = "";
        hide(el.panel);
        await loadStatusAndApply();
    }

    // --- Enroll: cancel ---
    async function handleCancelEnroll() {
        setSecret("");
        setQR("");
        if (el.code) el.code.value = "";
        hide(el.panel);
        await loadStatusAndApply();
    }

    // --- Reset MFA ---
    async function handleResetSubmit(e) {
        e.preventDefault();
        const password = (el.resetPassword?.value || "").trim();

        const res = await window.API.postJson("/user/mfa/reset", { password });
        if (!res.success) {
            const msg = res.message || res.error || "איפוס קוד לאימות דו-שלבי נכשל.";
            return window.Toast.warning(msg);
        }


        window.Toast.success("הקוד לאימות דו-שלבי אופס בהצלחה.");
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

    loadStatusAndApply();

})();

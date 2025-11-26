// Office Profiles Management JS
(() => {
    const api = {
        list: () => window.API.getJson("/get_office_profiles"),
        create: (name) => window.API.postJson("/create_new_profile", { name }),
        get: (serial) =>
            window.API.getJson(`/get_profile?serial=${encodeURIComponent(serial)}`),

        updateStatuses: (serial, operator, body) =>
            window.API.apiRequest(
                `/update_profile_statuses?serial=${encodeURIComponent(serial)}`,
                { method: "PATCH", body: { _operator: operator, ...body } }
            ),

        addStatus: (serial, scope, value) =>
            window.API.apiRequest(
                `/add_profile_status?serial=${encodeURIComponent(
                    serial
                )}&scope=${encodeURIComponent(scope)}`,
                { method: "PATCH", body: { value } }
            ),

        removeStatus: (serial, scope, value) =>
            window.API.apiRequest(
                `/remove_profile_status?serial=${encodeURIComponent(
                    serial
                )}&scope=${encodeURIComponent(scope)}`,
                { method: "PATCH", body: { value } }
            ),

        deleteProfile: (serial) =>
            window.API.apiRequest(
                `/delete_profile?serial=${encodeURIComponent(serial)}`,
                { method: "DELETE" }
            ),
    };

    let state = {
        profiles: [],
        selected: null, // flat profile object
    };

    // DOM refs
    const elProfilesList = document.getElementById("profiles-list");
    const elNewProfileName = document.getElementById("new-profile-name");
    const elBtnCreateProfile = document.getElementById("btn-create-profile");

    const elNoProfile = document.getElementById("no-profile-selected");
    const elEditor = document.getElementById("profile-editor");
    const elCaseWrap = document.getElementById("case-statuses");
    const elTaskWrap = document.getElementById("task-statuses");
    const elInputCase = document.getElementById("input-case-status");
    const elBtnAddCase = document.getElementById("btn-add-case-status");
    const elInputTask = document.getElementById("input-task-status");
    const elBtnAddTask = document.getElementById("btn-add-task-status");
    const elBtnSave = document.getElementById("btn-save-statuses");
    const elBtnDeleteProfile = document.getElementById("btn-delete-profile");

    // Helpers
    function toastOk(msg) { window.toasts?.success?.(msg) || console.log("[OK]", msg); }
    function toastErr(msg) { window.toasts?.error?.(msg) || console.error("[ERR]", msg); }

    function renderProfiles() {
        elProfilesList.innerHTML = "";
        if (!state.profiles.length) {
            elProfilesList.innerHTML = `<li class="list-group-item text-muted">אין פרופילים עדיין</li>`;
            selectProfile(null);
            return;
        }
        state.profiles.forEach((p) => {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-center profile-row";
            if (state.selected && state.selected.serial === p.serial) li.classList.add("selected");

            const left = document.createElement("div");
            left.className = "d-flex flex-column";
            left.innerHTML = `
                <strong>#${p.serial} — ${p.name || "(ללא שם)"}</strong>
                <span class="text-muted small">${p.created_at || ""}</span>
            `;

            const right = document.createElement("div");
            right.className = "small text-muted";
            const casesCount = Array.isArray(p.case_statuses) ? p.case_statuses.length : 0;
            const tasksCount = Array.isArray(p.task_statuses) ? p.task_statuses.length : 0;
            right.textContent = `${casesCount} סטטוסי תיקים • ${tasksCount} סטטוסי משימות`;

            li.appendChild(left);
            li.appendChild(right);

            li.onclick = () => selectProfile(p);
            elProfilesList.appendChild(li);
        });
    }

    function selectProfile(p) {
        state.selected = p;
        renderProfiles(); // refresh selection highlight
        if (!p) {
            elNoProfile.classList.remove("d-none");
            elEditor.classList.add("d-none");
            return;
        }
        elNoProfile.classList.add("d-none");
        elEditor.classList.remove("d-none");
        renderStatuses();
    }

    function asArray(v) {
        if (Array.isArray(v)) return v;
        if (!v && v !== 0) return [];
        return [v];
    }

    function renderStatuses() {
        const prof = state.selected || {};
        const caseList = asArray(prof.case_statuses);
        const taskList = asArray(prof.task_statuses);

        // Render badges
        elCaseWrap.innerHTML = caseList.length ? "" : `<span class="text-muted">אין סטטוסים</span>`;
        caseList.forEach((val) => elCaseWrap.appendChild(makeBadge("case", val)));

        elTaskWrap.innerHTML = taskList.length ? "" : `<span class="text-muted">אין סטטוסים</span>`;
        taskList.forEach((val) => elTaskWrap.appendChild(makeBadge("task", val)));

        // Clear inputs
        elInputCase.value = "";
        elInputTask.value = "";
    }

    function normalizeValue(raw) {
        if (typeof raw !== "string") return raw;
        const trimmed = raw.trim();
        return trimmed;
    }

    function makeBadge(scope, value) {
        const badge = document.createElement("span");
        badge.className = "badge text-bg-light d-inline-flex align-items-center gap-2 status-badge";
        badge.dir = "rtl";

        // show string or JSON value short
        const label = (typeof value === "string") ? value : JSON.stringify(value);
        badge.innerHTML = `<span>${label}</span>`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-close btn-close-black btn-sm";
        btn.ariaLabel = "Remove";
        btn.onclick = async (e) => {
            e.stopPropagation();
            try {
                await api.removeStatus(state.selected.serial, scope, value);
                // mutate local state and re-render
                const field = scope === "case" ? "case_statuses" : "task_statuses";
                const arr = asArray(state.selected[field]).filter((v) => JSON.stringify(v) !== JSON.stringify(value));
                state.selected[field] = arr;
                renderStatuses();
                toastOk("הוסר");
            } catch (err) {
                console.error("profile error:", err);
                toastErr("כישלון בהסרה");
            }
        };
        badge.appendChild(btn);
        return badge;
    }

    // Events
    elBtnCreateProfile?.addEventListener("click", async () => {
        try {
            const name = (elNewProfileName.value || "").trim();
            const res = await api.create(name);
            if (!res?.success) throw new Error(res?.error || "failed");
            toastOk("פרופיל נוצר");
            await loadProfiles();
            // auto-select last (assuming it’s the newly created)
            if (state.profiles.length) selectProfile(state.profiles[state.profiles.length - 1]);
            elNewProfileName.value = "";
        } catch (e) {
            console.error("profile error:", e);
            toastErr("כישלון ביצירת פרופיל");
        }
    });

    elBtnAddCase?.addEventListener("click", async () => {
        if (!state.selected) return;
        const v = normalizeValue(elInputCase.value);
        if (!v) return;
        try {
            await api.addStatus(state.selected.serial, "case", v);
            state.selected.case_statuses = [...asArray(state.selected.case_statuses), v];
            renderStatuses();
            toastOk("נוסף סטטוס תיק");
        } catch (e) {
            console.error("profile error:", e);
            toastErr("כישלון בהוספה");
        }
    });

    elBtnAddTask?.addEventListener("click", async () => {
        if (!state.selected) return;
        const v = normalizeValue(elInputTask.value);
        if (!v) return;
        try {
            await api.addStatus(state.selected.serial, "task", v);
            state.selected.task_statuses = [...asArray(state.selected.task_statuses), v];
            renderStatuses();
            toastOk("נוסף סטטוס משימה");
        } catch (e) {
            console.error("profile error:", e);
            toastErr("כישלון בהוספה");
        }
    });

    elBtnSave?.addEventListener("click", async () => {
        if (!state.selected) return;
        try {
            const body = {
                case_statuses: asArray(state.selected.case_statuses),
                task_statuses: asArray(state.selected.task_statuses),
            };
            await api.updateStatuses(state.selected.serial, "$set", body);
            toastOk("נשמר");
        } catch (e) {
            console.error("profile error:", e);
            toastErr("כישלון בשמירה");
        }
    });

    elBtnDeleteProfile?.addEventListener("click", async () => {
        if (!state.selected) return;
        if (!confirm("למחוק את הפרופיל הנבחר?")) return;
        try {
            await api.deleteProfile(state.selected.serial);
            toastOk("נמחק");
            await loadProfiles();
        } catch (e) {
            console.error("profile error:", e);
            toastErr("כישלון במחיקה");
        }
    });

    async function loadProfiles() {
        try {
            const res = await api.list();
            if (!res?.success) throw new Error(res?.error || "failed");
            state.profiles = res.data || [];
            // If selected serial no longer exists, clear selection
            if (!state.selected || !state.profiles.some((p) => p.serial === state.selected.serial)) {
                selectProfile(state.profiles[0] || null);
            } else {
                // rebind selected from new array
                state.selected = state.profiles.find((p) => p.serial === state.selected.serial) || null;
                renderProfiles();
                renderStatuses();
            }
        } catch (e) {
            state.profiles = [];
            selectProfile(null);
        }
    }

    // Public init
    window.initOfficeProfiles = async function () {
        await window.utils?.waitForDom?.();
        await loadProfiles();
    };
})();



// --- Auto-init on DOM ready ---
document.addEventListener("DOMContentLoaded", () => {
    const hasSection = document.getElementById("office-profiles");
    if (hasSection && typeof window.initOfficeProfiles === "function") {
        window.initOfficeProfiles();
    }
});

// --- Also handle dynamic HTML injection (if office_details loaded later) ---
const __profilesObserver = new MutationObserver((mutations, obs) => {
    const el = document.getElementById("office-profiles");
    if (el && typeof window.initOfficeProfiles === "function") {
        window.initOfficeProfiles();
        obs.disconnect();
    }
});
__profilesObserver.observe(document.body, { childList: true, subtree: true });
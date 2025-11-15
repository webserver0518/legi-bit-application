/*************************************************
 * loader.admin.js – Admin loader facade
 * Temporary facade over window.Loader (legacy).
 * Exposes window.AdminLoader with the same API.
 **************************************************/
if (!window.Loader || typeof window.Loader.loadPage !== "function") {
    throw new Error("loader.admin.js: window.Loader is not available yet");
}

window.AdminLoader = {
    async loadPage({ page, type = "admin", force = false }) {
        return window.Loader.loadPage({ page, type, force });
    },
    async navigate({ linkEl = null, page = null, type = "admin", force = false }) {
        return window.Loader.navigate({ linkEl, page, type, force });
    }
};

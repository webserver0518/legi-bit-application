/*************************************************
 * loader.user.js – User/Site loader facade
 * Temporary facade over window.Loader (legacy).
 * Exposes window.UserLoader with the same API.
 **************************************************/
if (!window.Loader || typeof window.Loader.loadPage !== "function") {
    throw new Error("loader.user.js: window.Loader is not available yet");
}

window.UserLoader = {
    async loadPage({ page, type = "user", force = false }) {
        return window.Loader.loadPage({ page, type, force });
    },
    async navigate({ linkEl = null, page = null, type = "user", force = false }) {
        return window.Loader.navigate({ linkEl, page, type, force });
    }
};

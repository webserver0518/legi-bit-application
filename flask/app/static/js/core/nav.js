/*************************************************
 * core/nav.js – Navigation / Sidebar helpers
 **************************************************/

/**
 * הבלטת לינק נבחר בסיידבר/תת־סיידבר
 * @param {Element} linkEl – <a>
 * @param {string} [sidebarClass='sidebar'] – container class: 'sidebar' / 'sub-sidebar'
 */
export function highlightInSidebar(linkEl, sidebarClass = 'sidebar') {
    if (!linkEl) return;
    const root = document.querySelector(`.${sidebarClass}`);
    if (!root) return;

    // נקה סימון קודם
    root.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));

    // סמן את הנוכחי
    linkEl.classList.add('active');

    // אם צריך: לגלול את הפריט לתוך התצוגה
    if (typeof linkEl.scrollIntoView === 'function') {
        linkEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
}

/**
 * שמירת ניווט אחרון
 */
export function setLastPage(page, type = 'user') {
    const store = window.Core?.storage?.create('navigation');
    if (!store) return;
    store.set('lastPage', { page, type, at: Date.now() });
}

/**
 * קריאה לניווט אחרון (אם צריך)
 */
export function getLastPage() {
    const store = window.Core?.storage?.create('navigation');
    if (!store) return null;
    return store.get('lastPage');
}

export default { highlightInSidebar, setLastPage, getLastPage };

// --- Recents Manager (queue of last items) ---
(function () {
    const MAX = 10;
    const store = window.Core.storage.create('recents'); // uses localStorage if available

    const keyFor = (kind) => `recent_${kind}s`; // 'case' -> 'recent_cases'
    const titlesKey = 'recent_case_titles';
    const officeTitlesKey = 'recent_office_titles';

    function get(kind) {
        return store.get(keyFor(kind), []);
    }

    function set(kind, arr) {
        store.set(keyFor(kind), Array.isArray(arr) ? arr : []);
        return get(kind);
    }

    // ---- Titles map (serial -> title) ----
    function getTitlesMap() {
        return store.get(titlesKey, {});
    }
    function setTitlesMap(map) {
        store.set(titlesKey, map || {});
        return getTitlesMap();
    }
    function setCaseTitle(serial, title) {
        const s = String(serial ?? '');
        if (!s) return;
        const map = getTitlesMap();
        map[s] = String(title ?? '').trim();
        setTitlesMap(map);
    }
    function getCaseTitle(serial) {
        const map = getTitlesMap();
        return map[String(serial ?? '')] || '';
    }

    // touch: move to front if exists; otherwise add to front; cap length to MAX
    function touch(kind, id) {
        const sid = String(id ?? '');
        if (!sid) return { list: get(kind), existed: false };

        let list = get(kind).filter(x => x !== sid); // remove if existed
        const existed = (list.length !== get(kind).length);
        list.unshift(sid);                            // put at front
        if (list.length > MAX) list = list.slice(0, MAX);

        set(kind, list);
        return { list, existed };
    }

    function remove(kind, id) {
        const sid = String(id ?? '');
        if (!sid) return get(kind);
        const list = get(kind).filter(x => x !== sid);
        set(kind, list);
        return list;
    }

    async function openCase(serial) {
        touch('case', serial);
        window.renderRecentCases();

        const a = document.querySelector(`.sub-sidebar a.recent-case[data-case-serial="${serial}"]`);
        if (a) window.Nav.highlightInSidebar(a, 'sub-sidebar');

        await window.UserLoader.navigate({ page: 'view_case', force: true });
    }

    async function openOffice(serial) {
        touch('office', serial);
        window.renderRecentOffices();

        const a = document.querySelector(`.sub-sidebar a.recent-office[data-office-serial="${serial}"]`);
        if (a) window.Nav.highlightInSidebar(a, 'sub-sidebar');

        await window.AdminLoader.navigate({ page: 'view_office', force: true });
    }

    function getOfficeTitlesMap() {
        return store.get(officeTitlesKey, {});
    }
    function setOfficeTitlesMap(map) {
        store.set(officeTitlesKey, map || {});
        return getOfficeTitlesMap();
    }
    function setOfficeTitle(serial, title) {
        const s = String(serial ?? '');
        const t = String(title ?? '').trim();
        if (!s || !t) return;
        const map = getOfficeTitlesMap();
        map[s] = t;
        setOfficeTitlesMap(map);
    }
    function getOfficeTitle(serial) {
        const map = getOfficeTitlesMap();
        return map[String(serial ?? '')] || '';
    }

    window.Recents = {
        get, set, touch, remove, openCase, openOffice,
        setCaseTitle, getCaseTitle,
        setOfficeTitle, getOfficeTitle
    };
})();



// --- Recent Cases UI helpers ---
function renderRecentCases() {
    const ul = document.getElementById('recent-cases-list');
    if (!ul) return;

    const list = window.Recents.get('case');
    ul.innerHTML = '';

    const frag = document.createDocumentFragment();
    list.forEach(serial => {
        const title = window.Recents.getCaseTitle(serial) || `תיק #${serial}`;
        const li = document.createElement('li');
        li.innerHTML = `
      <a href="#" class="sub-sidebar-link recent-case"
         data-type="user" data-sidebar="sub-sidebar"
         data-page="view_case"
         data-case-serial="${serial}">
        ${title}
        <button type="button"
                class="recent-remove"
                data-case-serial="${serial}"
                aria-label="הסר מהרשימה"
                title="הסר">×</button>
      </a>`;
        frag.appendChild(li);
    });
    ul.appendChild(frag);
}
function bindRecentCasesEvents() {
    const cont = document.getElementById('subMenu');
    if (!cont) return;

    cont.addEventListener('click', (e) => {
        // לחיצה על ✕ – מוחקים מהרשימה ולא מנווטים
        const btn = e.target.closest('button.recent-remove');
        if (btn) {
            e.preventDefault();
            e.stopPropagation(); // לא לתת ל-click של ה<a> לבעוט
            const serial = btn.dataset.caseSerial || btn.closest('a.recent-case')?.dataset.caseSerial;
            window.Recents.remove('case', serial);
            window.renderRecentCases?.();
            window.Toast?.success?.('התיק הוסר מרשימת האחרונים');
            return;
        }

        // לחיצה על הפריט עצמו – פותחים את התיק
        const a = e.target.closest('a.recent-case');
        if (!a) return;
        e.preventDefault();
        const serial = a.dataset.caseSerial;
        window.Recents.openCase(serial);
    });
}


function renderRecentOffices() {
    const ul = document.getElementById('recent-offices-list');
    if (!ul) return;

    const list = window.Recents.get('office');
    ul.innerHTML = '';

    const frag = document.createDocumentFragment();
    list.forEach(serial => {
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="#" class="sub-sidebar-link recent-office"
               data-type="office"
               data-office-serial="${serial}">
              ${window.Recents.getOfficeTitle(serial)}
            </a>`;
        frag.appendChild(li);
    });
    ul.appendChild(frag);
}


function bindRecentOfficesEvents() {
    const cont = document.getElementById('subMenu');
    if (!cont) return;

    cont.addEventListener('click', (e) => {
        const a = e.target.closest('a.recent-office');
        if (!a) return;
        e.preventDefault();
        const serial = a.dataset.officeSerial;
        window.Recents.openOffice(serial);
    });
}
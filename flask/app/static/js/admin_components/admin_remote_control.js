// flask/app/static/js/admin_components/admin_remote_control.js
(function () {
    'use strict';

    const ICE_DEFAULT = [{ urls: 'stun:stun.l.google.com:19302' }];
    const $ = (sel) => document.querySelector(sel);

    function getIceServers() {
        return (window.WEBRTC_ICE_SERVERS && Array.isArray(window.WEBRTC_ICE_SERVERS) && window.WEBRTC_ICE_SERVERS.length)
            ? window.WEBRTC_ICE_SERVERS
            : ICE_DEFAULT;
    }
    async function postJSON(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data || {})
        });
        return res.json();
    }
    async function delJSON(url, data) {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data || {})
        });
        return res.json();
    }
    async function getJSON(url) {
        const res = await fetch(url, { credentials: 'include' });
        return res.json();
    }
    function waitForIceComplete(pc) {
        return new Promise((resolve) => {
            if (pc.iceGatheringState === 'complete') return resolve();
            const check = () => {
                if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); }
            };
            pc.addEventListener('icegatheringstatechange', check);
            setTimeout(() => { pc.removeEventListener('icegatheringstatechange', check); resolve(); }, 6000);
        });
    }
    function fmtCode(c) { const s = String(c || ''); return s.length === 6 ? `${s.slice(0, 3)}-${s.slice(3)}` : s; }
    function fmtTTL(sec) { const n = Math.max(0, parseInt(sec || 0, 10)); const m = String(Math.floor(n / 60)).padStart(2, '0'); const s = String(n % 60).padStart(2, '0'); return `${m}:${s}`; }
    function toast(msg, type = 'info') { const fn = window.Toast?.[type] || window.Toast?.info; fn ? fn(msg) : console.log(`[${type}]`, msg); }
    function el(tag, attrs = {}, children = []) {
        const n = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => {
            if (k === 'class') n.className = v;
            else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
            else n.setAttribute(k, v);
        });
        ([]).concat(children).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
        return n;
    }

    window.init_admin_remote_control = function init_admin_remote_control() {
        const root = document.getElementById('admin-remote-control') || document;
        const video = root.querySelector('[data-rc="video"]');
        const status = root.querySelector('[data-rc="status"]');
        const listEl = root.querySelector('#rc-pending-list');
        const refreshBtn = root.querySelector('[data-action="refresh-pending"]');

        let pc = null;
        let currentCode = null;
        let currentMeta = null;

        async function cleanup() {
            try { if (pc) { pc.ontrack = null; pc.close(); } } catch { }
            pc = null;
            currentCode = null;
            currentMeta = null;
            if (video) video.srcObject = null;
            if (status) status.textContent = 'מצב: ממתין לחיבור…';
        }

        async function doJoin(code) {
            code = String(code || '').trim();
            if (!/^\d{6}$/.test(code)) { toast('קוד לא תקין.', 'danger'); return; }

            try {
                const join = await postJSON('/admin/webrtc/join', { code });
                if (!join?.success) { toast(join?.message || 'לא נמצא שיתוף עבור הקוד.', 'danger'); return; }

                const offer = join.data?.offer;
                currentMeta = join.data?.meta || null;

                pc = new RTCPeerConnection({ iceServers: getIceServers() });
                pc.ontrack = (ev) => {
                    const inbound = ev.streams?.[0] || new MediaStream([ev.track]);
                    video.srcObject = inbound;
                    video.play?.().catch(() => { });
                };

                await pc.setRemoteDescription(offer);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await waitForIceComplete(pc);

                const up = await postJSON('/admin/webrtc/answer', { code, answer: pc.localDescription });
                if (!up?.success) { toast(up?.message || 'נכשלה העלאת ה-Answer.', 'danger'); await cleanup(); return; }

                currentCode = code;
                if (status) {
                    const who = currentMeta ? `${currentMeta.user_name || 'משתמש'} (משרד ${currentMeta.office_name || currentMeta.office_serial || '-'})` : '—';
                    status.textContent = `מצב: צופה ב־${who}`;
                }
                toast('מחובר לצפייה.', 'success');

            } catch (e) {
                console.error(e);
                toast('שגיאה בהצטרפות לשיתוף.', 'danger');
                await cleanup();
            }
        }

        async function refreshPending() {
            try {
                const res = await getJSON('/admin/webrtc/pending');
                if (!res?.success) { return; }
                renderPending(res.data?.items || []);
            } catch { }
        }

        function renderPending(items) {
            listEl.innerHTML = '';
            if (!items.length) {
                listEl.appendChild(el('div', { class: 'pending-empty muted small' }, ['אין כרגע משתמשים ממתינים.']));
                return;
            }
            items.forEach((it) => {
                const meta = it.meta || {};
                const title = `${meta.user_name || 'משתמש לא ידוע'}`;
                const sub = `משרד ${meta.office_name || meta.office_serial || 'לא ידוע'} • קוד ${fmtCode(it.code)} • נותר ${fmtTTL(it.ttl_left)}`;

                const joinBtn = el('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'join', 'data-code': it.code }, ['הצטרף']);
                const ext10Btn = el('button', { class: 'btn', type: 'button', 'data-action': 'extend', 'data-code': it.code, 'data-minutes': '10' }, ['+10']);
                const ext20Btn = el('button', { class: 'btn', type: 'button', 'data-action': 'extend', 'data-code': it.code, 'data-minutes': '20' }, ['+20']);
                const delBtn = el('button', { class: 'btn btn-danger', type: 'button', 'data-action': 'delete', 'data-code': it.code }, ['מחק']);

                const card = el('div', { class: 'pending-card' }, [
                    el('div', { class: 'pending-info' }, [
                        el('div', { class: 'pending-title' }, [title]),
                        el('div', { class: 'pending-sub' }, [sub]),
                    ]),
                    el('div', { class: 'pending-actions' }, [joinBtn, ext10Btn, ext20Btn, delBtn]),
                ]);
                listEl.appendChild(card);
            });
        }

        // האזנה לפעולות כפתורים ברשימה
        listEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const code = btn.getAttribute('data-code');

            if (action === 'join') {
                await doJoin(code);
            } else if (action === 'extend') {
                const minutes = parseInt(btn.getAttribute('data-minutes') || '0', 10);
                const res = await postJSON('/admin/webrtc/extend', { code, minutes });
                if (res?.success) { toast('התוקף הוארך.', 'success'); refreshPending(); }
                else { toast(res?.message || 'פעולת הארכה נכשלה.', 'danger'); }
            } else if (action === 'delete') {
                const res = await delJSON('/admin/webrtc/delete', { code });
                if (res?.success) { toast('השיתוף נמחק.', 'success'); if (code === currentCode) await cleanup(); refreshPending(); }
                else { toast(res?.message || 'מחיקה נכשלה.', 'danger'); }
            }
        });

        // רענון
        refreshBtn?.addEventListener('click', (e) => { e.preventDefault(); refreshPending(); });

        // מחזור אוטו כל 5 שניות
        refreshPending();
        const pendTimer = setInterval(refreshPending, 5000);
        window.addEventListener('beforeunload', () => { clearInterval(pendTimer); cleanup(); });
    };
})();

// flask/app/static/js/user_components/remote_control.js
(function () {
    'use strict';

    const ICE_DEFAULT = [{ urls: 'stun:stun.l.google.com:19302' }];

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

    function waitForIceComplete(pc) {
        return new Promise((resolve) => {
            if (pc.iceGatheringState === 'complete') return resolve();
            const check = () => {
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', check);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', check);
            setTimeout(() => { pc.removeEventListener('icegatheringstatechange', check); resolve(); }, 6000);
        });
    }

    function showToast(msg, type = 'info') {
        if (window.Toast?.info) {
            const fn = window.Toast[type] || window.Toast.info;
            fn(msg);
        } else {
            console.log(`[${type}]`, msg);
        }
    }

    function nowSec() { return Math.floor(Date.now() / 1000); }

    function formatCode(code) {
        const s = String(code || '').trim();
        return s.length === 6 ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
    }

    function el(tag, attrs = {}, children = []) {
        const n = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => {
            if (k === 'class') n.className = v;
            else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
            else n.setAttribute(k, v);
        });
        ([]).concat(children).forEach(c => {
            if (c == null) return;
            n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return n;
    }

    function mountSessionBanner(anchorEl, { code, ttlSeconds, onStop }) {
        const parentCard = anchorEl?.closest('.card') || document.querySelector('#remote-control');
        if (!parentCard) return { unmount() { } };

        const until = nowSec() + (Number(ttlSeconds) || 600);
        const banner = el('div', {
            class: 'rc-session-banner',
            style: { marginTop: '10px', border: '1px solid #e6effa', borderRadius: '10px', padding: '10px 12px', background: '#f7fbff' }
        }, [
            el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' } }, [
                el('div', {}, [
                    el('div', { style: { fontWeight: '800' } }, 'שיתוף מסך פעיל'),
                    el('div', { style: { color: '#4b5563' } }, `קוד: ${formatCode(code)}`)
                ]),
                el('div', { style: { display: 'flex', gap: '8px' } }, [
                    el('button', { class: 'btn', type: 'button' }, 'העתק קוד'),
                    el('button', { class: 'btn', type: 'button' }, 'סיום שיתוף')
                ])
            ]),
            el('div', { style: { marginTop: '6px', fontSize: '.9rem', color: '#4b5563' } }, 'תוקף קוד: ‎—‎')
        ]);

        const [copyBtn, stopBtn] = banner.querySelectorAll('button');
        const ttlLine = banner.lastChild;

        let timer = setInterval(() => {
            const left = Math.max(0, until - nowSec());
            const m = String(Math.floor(left / 60)).padStart(2, '0');
            const s = String(left % 60).padStart(2, '0');
            ttlLine.textContent = `תוקף קוד: ${m}:${s}`;
            if (left <= 0) {
                clearInterval(timer);
                ttlLine.textContent = 'תוקף קוד פג';
            }
        }, 1000);

        copyBtn.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(String(code)); showToast('הקוד הועתק.', 'success'); }
            catch { showToast('לא הצלחתי להעתיק. העתק ידנית.', 'danger'); }
        });

        stopBtn.addEventListener('click', () => onStop?.());

        parentCard.appendChild(banner);
        return { unmount() { clearInterval(timer); banner.remove(); } };
    }

    window.init_remote_control = function init_remote_control() {
        const root = document.getElementById('remote-control');
        if (!root) return;

        const btnRemote = root.querySelector('[data-action="start-full-remote"]');
        const btnView = root.querySelector('[data-action="start-view-only"]');

        // “שליטה מרחוק” דרך Chrome Remote Desktop
        btnRemote?.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://remotedesktop.google.com/support', '_blank', 'noopener');
        });

        let pc = null, stream = null, pollTimer = null, bannerCtl = null, currentCode = null;

        async function stopServerSession() {
            if (!currentCode) return;
            try { await postJSON('/webrtc/session/stop', { code: currentCode }); }
            catch { }
        }

        async function cleanup() {
            try {
                if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
                if (pc) { pc.ontrack = null; pc.close(); pc = null; }
                if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
            } catch { }
            if (bannerCtl) { bannerCtl.unmount(); bannerCtl = null; }
            await stopServerSession();
            currentCode = null;
            btnView?.setAttribute('aria-disabled', 'false');
        }

        async function startViewOnly() {
            if (btnView?.getAttribute('aria-disabled') === 'true') return;
            btnView?.setAttribute('aria-disabled', 'true');

            try {
                // 1) יצירת קוד + מטא בשרת
                const c = await postJSON('/webrtc/session/create', {});
                if (!c?.success) { showToast(c?.message || 'נכשלה יצירת קוד.', 'danger'); btnView?.setAttribute('aria-disabled', 'false'); return; }
                const { code, ttl_seconds } = c.data || {};
                if (!code) throw new Error('missing code');
                currentCode = code;

                // 2) באנר קטן עם קוד וסיום
                bannerCtl = mountSessionBanner(btnView, { code, ttlSeconds: ttl_seconds || 600, onStop: cleanup });

                // 3) שיתוף מסך
                try {
                    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
                } catch {
                    showToast('שיתוף המסך בוטל.', 'danger');
                    await cleanup(); return;
                }

                // 4) PeerConnection + Offer
                pc = new RTCPeerConnection({ iceServers: getIceServers() });
                stream.getTracks().forEach(t => pc.addTrack(t, stream));

                const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
                await pc.setLocalDescription(offer);
                await waitForIceComplete(pc);

                const up = await postJSON('/webrtc/offer', { code, offer: pc.localDescription });
                if (!up?.success) { showToast(up?.message || 'נכשלה העלאת ההצעה.', 'danger'); await cleanup(); return; }

                // 5) Poll תשובה מהאדמין
                pollTimer = setInterval(async () => {
                    try {
                        const ans = await postJSON('/webrtc/answer/get', { code });
                        if (!ans?.success) return;
                        const answer = ans?.data?.answer;
                        if (!answer) return;
                        await pc.setRemoteDescription(answer);
                        clearInterval(pollTimer); pollTimer = null;
                        showToast('מחובר לטכנאי.', 'success');
                    } catch { }
                }, 2000);

                // 6) אם המשתמש עצר את ההקלטה – ננקה וגם נמחוק מהשרת
                const vt = stream.getVideoTracks()[0];
                vt && vt.addEventListener('ended', () => { showToast('שיתוף המסך הופסק.', 'info'); cleanup(); }, { once: true });

            } catch (err) {
                console.error(err);
                showToast('שגיאה בהתחלת שיתוף.', 'danger');
                await cleanup();
            }
        }

        btnView?.addEventListener('click', (e) => { e.preventDefault(); startViewOnly(); });
        window.addEventListener('beforeunload', cleanup);
    };
})();

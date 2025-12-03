// remote_control.js
(function () {
    'use strict';

    // ---- Toast helpers (fallbacks if your Toast util isn't loaded) ----
    const toast = {
        ok: (m) => (window.Toast?.success ? Toast.success(m) : alert(m)),
        info: (m) => (window.Toast?.info ? Toast.info(m) : console.log(m)),
        warn: (m) => (window.Toast?.warning ? Toast.warning(m) : alert(m)),
        err: (m) => (window.Toast?.error ? Toast.error(m) : alert(m)),
    };

    // ---- Tiny store (localStorage with memory fallback) ----
    const Store = (() => {
        try {
            const ns = 'remote_control';
            return {
                set: (k, v) => localStorage.setItem(`${ns}:${k}`, JSON.stringify(v)),
                get: (k, d = null) => {
                    const raw = localStorage.getItem(`${ns}:${k}`);
                    return raw ? JSON.parse(raw) : d;
                },
                del: (k) => localStorage.removeItem(`${ns}:${k}`),
            };
        } catch {
            const mem = {};
            return {
                set: (k, v) => (mem[k] = v),
                get: (k, d = null) => (k in mem ? mem[k] : d),
                del: (k) => delete mem[k],
            };
        }
    })();

    // ========= CRD WIZARD ========
    // Small helper to drive the “Chrome Remote Desktop-like” wizard UI
    const CRD = (() => {
        function init() {
            const root = document.getElementById('remote-control');
            if (!root) return;

            const wizard = root.querySelector('[data-crd-wizard]');
            if (!wizard) return;

            const stepEls = wizard.querySelectorAll('[data-step]');
            const step1 = wizard.querySelector('[data-step="1"]');
            const step2 = wizard.querySelector('[data-step="2"]');
            const step3 = wizard.querySelector('[data-step="3"]');

            const btnNext1 = wizard.querySelector('[data-next="1"]');
            const btnNext2 = wizard.querySelector('[data-next="2"]');
            const btnBack2 = wizard.querySelector('[data-back="2"]');
            const btnBack3 = wizard.querySelector('[data-back="3"]');
            const btnRestart = wizard.querySelector('[data-restart]');
            const btnClear = wizard.querySelector('[data-clear-code]');
            const codeInput = wizard.querySelector('[data-code-input]');
            const codeOutput = wizard.querySelector('[data-code-output]');
            const btnCopy = wizard.querySelector('[data-copy-code]');

            function formatCodeDisplay(raw) {
                const digits = (raw || '').replace(/\D+/g, '');
                return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
            }
            function isValidCode(raw) {
                const digits = (raw || '').replace(/\D+/g, '');
                return digits.length === 12;
            }
            function gotoStep(n) {
                document.querySelectorAll('#remote-control .step').forEach((el) => el.classList.remove('active'));
                document.querySelector(`#remote-control .step-${n}`)?.classList.add('active');
                document.querySelectorAll('#remote-control .step-chip').forEach((chip) => {
                    chip.classList.toggle('active', Number(chip.dataset.step) === n);
                });
            }

            if (step1) gotoStep(1);

            const startedCode = Store.get('crd_code', '');
            if (startedCode && codeInput) {
                codeInput.value = startedCode;
            }

            if (codeInput && btnNext2 && btnClear) {
                btnNext2.disabled = !isValidCode(codeInput.value.trim());

                codeInput.addEventListener('input', () => {
                    const val = codeInput.value.trim();
                    btnNext2.disabled = !isValidCode(val);
                });

                btnClear.addEventListener('click', () => {
                    codeInput.value = '';
                    btnNext2.disabled = true;
                    codeInput.focus();
                });

                btnNext1.addEventListener('click', () => gotoStep(2));
                btnBack2.addEventListener('click', () => gotoStep(1));

                btnNext2.addEventListener('click', () => {
                    const val = codeInput.value.trim();
                    if (!isValidCode(val)) {
                        toast.err('Please enter a valid 12-digit code.');
                        return;
                    }
                    Store.set('crd_code', val);
                    if (codeOutput) {
                        codeOutput.textContent = formatCodeDisplay(val);
                    }
                    gotoStep(3);
                });

                if (btnCopy && codeOutput) {
                    btnCopy.addEventListener('click', () => {
                        const text = codeOutput.textContent || '';
                        if (!text.trim()) return;
                        const normalized = text.replace(/\s+/g, '');
                        if (navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(normalized).then(
                                () => toast.ok('Code copied to clipboard'),
                                () => toast.warn('Could not copy automatically, please copy manually.')
                            );
                        } else {
                            try {
                                const ta = document.createElement('textarea');
                                ta.style.position = 'fixed';
                                ta.style.opacity = '0';
                                ta.value = normalized;
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand('copy');
                                document.body.removeChild(ta);
                                toast.ok('Code copied to clipboard');
                            } catch {
                                toast.info('Select and copy the code manually.');
                            }
                        }
                    });
                }

                btnBack3.addEventListener('click', () => gotoStep(2));
                btnRestart.addEventListener('click', () => {
                    codeInput.value = '';
                    btnNext2.disabled = true;
                    Store.del('crd_code');
                    codeOutput.textContent = '— — — —';
                    gotoStep(1);
                });
            }

            return { gotoStep };
        }

        return { init };
    })();

    // ========= WEBRTC VIEW-ONLY =========

    const WebRTC = (() => {
        const rtc = {
            stream: null,
            pc: null,
            viewerPc: null,
        };

        function setShareUI({ running }) {
            const preview = document.getElementById('share-preview');
            const start = document.getElementById('share-start');
            const stop = document.getElementById('share-stop');
            const pip = document.getElementById('pip-btn');
            const status = document.getElementById('share-status');

            start.disabled = !!running;
            stop.disabled = !running;
            pip.disabled = !running;

            if (status) {
                status.textContent = running
                    ? 'Sharing your screen…'
                    : 'Not sharing. Click "Share Screen" to begin.';
            }

            if (!running && preview && preview.srcObject) {
                const tracks = preview.srcObject.getTracks();
                tracks.forEach((t) => t.stop());
                preview.srcObject = null;
            }
        }

        async function waitForIceGathering(pc) {
            if (pc.iceGatheringState === 'complete') return;
            return new Promise((resolve) => {
                function checkState() {
                    if (pc.iceGatheringState === 'complete') {
                        pc.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                }
                pc.addEventListener('icegatheringstatechange', checkState);
            });
        }

        async function startShare() {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { frameRate: 15 },
                    audio: false,
                });
                rtc.stream = stream;

                const video = document.getElementById('share-preview');
                video.srcObject = stream;

                document.getElementById('make-offer').disabled = false;

                stream.getVideoTracks()[0].addEventListener('ended', () => {
                    stopShare();
                });
            } catch (err) {
                console.error(err);
                toast.err('Screen share was cancelled or blocked.');
            }
        }

        function stopShare() {
            if (rtc.stream) {
                rtc.stream.getTracks().forEach((t) => t.stop());
                rtc.stream = null;
            }
            if (rtc.pc) {
                rtc.pc.close();
                rtc.pc = null;
            }
            setShareUI({ running: false });
        }

        async function enterPiP() {
            const preview = document.getElementById('share-preview');
            if (!preview) return;
            if (!document.pictureInPictureEnabled) {
                toast.info('Picture-in-Picture is not supported in this browser.');
                return;
            }
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else if (preview.requestPictureInPicture) {
                    await preview.requestPictureInPicture();
                }
            } catch (e) {
                console.warn('PiP error', e);
            }
        }

        // --- Sharer side: create Offer, apply Answer (manual) ---
        async function makeOffer() {
            if (!rtc.stream) {
                toast.warn('Start screen sharing first.');
                return;
            }

            if (rtc.pc) {
                rtc.pc.close();
                rtc.pc = null;
            }
            rtc.pc = new RTCPeerConnection({
                iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
            });

            rtc.stream.getTracks().forEach((t) => rtc.pc.addTrack(t, rtc.stream));

            rtc.pc.oniceconnectionstatechange = () => {
                console.log('Sharer ICE state:', rtc.pc.iceConnectionState);
                if (rtc.pc.iceConnectionState === 'connected') {
                    toast.ok('Viewer connected.');
                }
            };

            const offer = await rtc.pc.createOffer({ offerToReceiveVideo: false });
            await rtc.pc.setLocalDescription(offer);
            await waitForIceGathering(rtc.pc);

            document.getElementById('offer-out').value = JSON.stringify(rtc.pc.localDescription);
            document.getElementById('apply-answer').disabled = false;
            toast.info('Offer created. Send to viewer.');
        }

        async function applyAnswer() {
            if (!rtc.pc) return;
            const raw = document.getElementById('answer-in').value.trim();
            if (!raw) {
                toast.warn('Paste the viewer’s Answer first.');
                return;
            }
            try {
                const answer = JSON.parse(raw);
                await rtc.pc.setRemoteDescription(answer);
                toast.ok('Answer applied. Waiting for connection…');
            } catch (e) {
                console.error(e);
                toast.err('Failed to apply Answer.');
            }
        }

        // --- Minimal copy-paste signaling (Viewer side) ---
        async function makeAnswer() {
            if (rtc.viewerPc) {
                rtc.viewerPc.close();
                rtc.viewerPc = null;
            }
            rtc.viewerPc = new RTCPeerConnection({
                iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
            });

            const remoteVideo = document.getElementById('viewer-video');
            rtc.viewerPc.ontrack = (ev) => {
                remoteVideo.srcObject = ev.streams[0];
            };

            const rawOffer = document.getElementById('offer-in').value.trim();
            if (!rawOffer) {
                toast.warn('Paste the sharer’s Offer first.');
                return;
            }

            let offerDesc;
            try {
                offerDesc = JSON.parse(rawOffer);
            } catch {
                toast.err('Invalid Offer JSON.');
                return;
            }

            await rtc.viewerPc.setRemoteDescription(offerDesc);
            const answer = await rtc.viewerPc.createAnswer();
            await rtc.viewerPc.setLocalDescription(answer);
            await waitForIceGathering(rtc.viewerPc);

            document.getElementById('answer-out').value = JSON.stringify(rtc.viewerPc.localDescription);
            toast.info('Answer created. Send back to sharer.');
        }

        function init() {
            const container = document.getElementById('remote-control');
            if (!container) return;

            const modeSharer = container.querySelector('input[name="webrtc-mode"][value="sharer"]');
            if (modeSharer) {
                modeSharer.checked = true;
            }

            const start = document.getElementById('share-start');
            const stop = document.getElementById('share-stop');
            const pip = document.getElementById('pip-btn');

            if (!start || !stop || !pip) {
                console.warn('WebRTC controls not found in DOM.');
                return;
            }

            start.addEventListener('click', startShare);
            stop.addEventListener('click', stopShare);
            pip.addEventListener('click', enterPiP);

            document.getElementById('make-offer').addEventListener('click', makeOffer);
            document.getElementById('apply-answer').addEventListener('click', applyAnswer);
            document.getElementById('make-answer').addEventListener('click', makeAnswer);

            // Role switching for manual signaling
            document.querySelectorAll('input[name="webrtc-mode"]').forEach((radio) => {
                radio.addEventListener('change', () => {
                    const mode = document.querySelector('input[name="webrtc-mode"]:checked')?.value || 'sharer';
                    document.querySelector('.signal-panel[data-role="sharer"]').classList.toggle('hidden', mode !== 'sharer');
                    document.querySelector('.signal-panel[data-role="viewer"]').classList.toggle('hidden', mode !== 'viewer');
                });
            });

            // URL hint ?viewer=1 auto-switches to viewer mode
            const params = new URLSearchParams(location.search);
            if (params.get('viewer') == '1') {
                document.querySelector('input[name="webrtc-mode"][value="viewer"]').checked = true;
                document.querySelector('.signal-panel[data-role="sharer"]').classList.add('hidden');
                document.querySelector('.signal-panel[data-role="viewer"]').classList.remove('hidden');
            }

            setShareUI({ running: false });
        }

        return { init };
    })();

    // ========= INIT HOOK =========
    // Your loader should call this after injecting the HTML.
    window.init_remote_control = function () {
        CRD.init();
        WebRTC.init();
    };

    // Fallback auto-init if loader doesn't call:
    function tryInit() {
        if (document.getElementById('remote-control')) {
            if (!window.__remote_control_inited) {
                window.__remote_control_inited = true;
                window.init_remote_control();
            }
        }
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(tryInit, 0);
    } else {
        document.addEventListener('DOMContentLoaded', tryInit);
    }
})();


// === Session code flow (copy-paste signaling already in your app) ===
(function () {
    const toast = {
        ok: (m) => (window.Toast?.success ? Toast.success(m) : alert(m)),
        info: (m) => (window.Toast?.info ? Toast.info(m) : console.log(m)),
        warn: (m) => (window.Toast?.warning ? Toast.warning(m) : alert(m)),
        err: (m) => (window.Toast?.error ? Toast.error(m) : alert(m)),
    };

    let sessionCode = null;
    let pollTimer = null;

    const elBtnCreate = document.getElementById('rc-create-session');
    const elBtnPublish = document.getElementById('rc-publish-offer');
    const elCode = document.getElementById('rc-session-code');

    function offerTextarea() { return document.getElementById('offer-out'); }
    function answerTextarea() { return document.getElementById('answer-in'); }

    async function createSession() {
        try {
            const res = await API.postJson('/webrtc/session/create', {});
            if (!res?.success) throw new Error(res?.error || 'Failed to create session');
            sessionCode = res.data.code;
            elBtnPublish.disabled = false;
            elCode.textContent = `Code: ${sessionCode} (valid ~${Math.round((res.data.ttl_seconds || 600) / 60)} min)`;
            toast.ok('Session code created. Create an Offer and then click "Publish Offer".');
        } catch (e) {
            toast.err(e.message || 'Create session failed');
        }
    }

    async function publishOffer() {
        try {
            if (!sessionCode) { toast.warn('Create session code first'); return; }
            const txt = (offerTextarea()?.value || '').trim();
            if (!txt) { toast.warn('Create Offer first (click "Create Offer")'); return; }

            let offer; try { offer = JSON.parse(txt); } catch { toast.err('Offer JSON is invalid'); return; }
            const res = await API.postJson('/webrtc/offer', { code: sessionCode, offer });
            if (!res?.success) throw new Error(res?.error || 'Failed to publish offer');

            toast.ok('Offer published. Ask admin to join with the code.');
            startPollingAnswer();
        } catch (e) {
            toast.err(e.message || 'Publish offer failed');
        }
    }

    async function pollAnswerOnce() {
        if (!sessionCode) return;
        const res = await API.postJson('/webrtc/answer/get', { code: sessionCode });
        const answer = res?.data?.answer;
        if (answer) {
            // Drop into existing flow: set textarea and click the existing Apply button
            answerTextarea().value = JSON.stringify(answer);
            document.getElementById('apply-answer')?.click();
            toast.ok('Admin connected.');
            return true;
        }
        return false;
    }

    function startPollingAnswer() {
        clearTimeout(pollTimer);
        (async function loop() {
            const done = await pollAnswerOnce();
            if (!done) pollTimer = setTimeout(loop, 1200);
        })();
    }

    if (elBtnCreate) elBtnCreate.addEventListener('click', createSession);
    if (elBtnPublish) elBtnPublish.addEventListener('click', publishOffer);
})();

let __autoInFlight = false;

// ===== Auto-offer & publish after Share Screen (least-intrusive addon) =====
(function () {
    // Do not touch existing scope; add minimal helpers and hook.
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    function getSessionCodeFromDom() {
        const el = document.getElementById('rc-session-code');
        if (!el) return null;
        const txt = el.textContent || '';
        const m = txt.match(/\d{6,}/);   // רצף ספרות ראשון לפחות 6 תווים
        return m ? m[0].slice(0, 6) : null;
    }

    async function waitForScreenShare(timeoutMs = 20000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const video = document.getElementById('share-preview');
            const ok = !!(video && video.srcObject && typeof video.srcObject.getVideoTracks === 'function' &&
                video.srcObject.getVideoTracks().length);
            if (ok) return true;
            await delay(400);
        }
        return false;
    }

    async function waitForOfferText(timeoutMs = 15000) {
        const start = Date.now();
        const area = document.getElementById('offer-out');
        while (Date.now() - start < timeoutMs) {
            if (area && area.value && area.value.trim()) return true;
            await delay(300);
        }
        return false;
    }

    async function postJson(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body || {}),
            credentials: 'same-origin',
        });
        return res.json().catch(() => ({}));
    }

    async function pollAnswerAndApply(sessionCode, timeoutMs = 120000) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            try {
                const res = await postJson('/webrtc/answer/get', { code: sessionCode });
                const answer = res && res.data && res.data.answer;
                if (answer) {
                    const ta = document.getElementById('answer-in');
                    if (ta) ta.value = JSON.stringify(answer);
                    const btn = document.getElementById('apply-answer');
                    if (btn) btn.click();
                    (window.Toast?.success ? Toast.success('Admin connected.') : console.log('Admin connected.'));
                    return true;
                }
            } catch (e) {
                console.warn('[auto-offer] polling error', e);
            }
            await delay(1200);
        }
        return false;
    }

    async function autoFlowAfterShare() {
        if (__autoInFlight) return;
        __autoInFlight = true;
        try {
            const code = getSessionCodeFromDom();
            if (!code) {
                (window.Toast?.warning ? Toast.warning('קודם צור קוד שיתוף (Generate Code).') : alert('Create code first.'));
                return;
            }

            const hasShare = await waitForScreenShare();
            if (!hasShare) {
                console.warn('[auto-offer] No screen share detected.');
                return;
            }

            // Trigger existing "Create Offer" flow
            const makeOfferBtn = document.getElementById('make-offer');
            if (!makeOfferBtn) {
                console.warn('[auto-offer] #make-offer not found');
                return;
            }
            try { makeOfferBtn.click(); } catch { }

            const gotOffer = await waitForOfferText();
            if (!gotOffer) {
                console.warn('[auto-offer] Offer did not appear.');
                return;
            }

            // Prefer using existing Publish button handler if present
            const publishBtn = document.getElementById('rc-publish-offer');
            if (publishBtn && !publishBtn.disabled) {
                try { publishBtn.click(); } catch { }
                return; // existing logic will start polling
            }

            // Fallback: direct post to server and start polling locally
            let offerJson = null;
            try {
                offerJson = JSON.parse(document.getElementById('offer-out').value);
            } catch {
                (window.Toast?.error ? Toast.error('Invalid Offer JSON') : alert('Invalid Offer JSON'));
                return;
            }

            const res = await postJson('/webrtc/offer', { code, offer: offerJson });
            if (!res || res.success === false) {
                const msg = (res && (res.error || res.message)) || 'Failed to publish offer';
                (window.Toast?.error ? Toast.error(msg) : alert(msg));
                return;
            }

            await pollAnswerAndApply(code);

        } finally {
            __autoInFlight = false;
        }

    }

    function hookShareButton() {
        const btn = document.getElementById('share-start');
        if (!btn) return;
        if (btn.__autoOfferHooked) return;
        btn.__autoOfferHooked = true;

        btn.addEventListener('click', () => {
            // Fire-and-forget automation; no interference with existing handlers
            setTimeout(autoFlowAfterShare, 0);
        });
    }

    function init() {
        hookShareButton();
        // also observe DOM mutations in case UI loads late
        const obs = new MutationObserver(() => hookShareButton());
        obs.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 0);
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();

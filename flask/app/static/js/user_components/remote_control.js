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
            return { set: (k, v) => (mem[k] = v), get: (k, d = null) => (k in mem ? mem[k] : d), del: (k) => delete mem[k] };
        }
    })();

    // ========= CRD WIZARD =========

    const CRD = (() => {
        function formatCodeDigits(raw) {
            const digits = (raw || '').replace(/\D+/g, '').slice(0, 12);
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

        function init() {
            const codeInput = document.getElementById('crd-code-input');
            const codeOutput = document.getElementById('crd-code-output');

            const btnNext1 = document.getElementById('crd-next-1');
            const btnBack2 = document.getElementById('crd-back-2');
            const btnNext2 = document.getElementById('crd-next-2');
            const btnClear = document.getElementById('crd-clear');
            const btnBack3 = document.getElementById('crd-back-3');
            const btnRestart = document.getElementById('crd-restart');
            const btnCopy = document.getElementById('crd-copy');

            // Pre-fill from URL ?code= or stored
            const params = new URLSearchParams(location.search);
            const pre = params.get('code') || Store.get('crd_code', '');
            if (pre) {
                const fmt = formatCodeDigits(pre);
                codeInput.value = fmt;
                btnNext2.disabled = !isValidCode(fmt);
            }

            codeInput.addEventListener('input', () => {
                const caretAtEnd = codeInput.selectionStart === codeInput.value.length;
                const fmt = formatCodeDigits(codeInput.value);
                codeInput.value = fmt;
                if (caretAtEnd) codeInput.selectionStart = codeInput.selectionEnd = codeInput.value.length;
                btnNext2.disabled = !isValidCode(fmt);
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
                    codeInput.focus();
                    return;
                }
                Store.set('crd_code', val);
                codeOutput.textContent = val;
                gotoStep(3);
                toast.ok('Code accepted. Keep this page open and confirm the prompt when it appears.');
            });

            btnCopy.addEventListener('click', async () => {
                const txt = (codeOutput.textContent || '').trim();
                try {
                    await navigator.clipboard.writeText(txt);
                    toast.ok('Code copied.');
                } catch {
                    toast.info('Select and copy the code manually.');
                }
            });

            btnBack3.addEventListener('click', () => gotoStep(2));
            btnRestart.addEventListener('click', () => {
                codeInput.value = '';
                btnNext2.disabled = true;
                Store.del('crd_code');
                codeOutput.textContent = '— — — —';
                gotoStep(1);
            });
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
            pip.disabled = !running || !document.pictureInPictureEnabled;

            status.textContent = running ? 'Sharing…' : '';
            preview.classList.toggle('active', !!running);
        }

        async function startShare() {
            if (rtc.stream) return;
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

                setShareUI({ running: true });
                toast.ok('Screen sharing started.');
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
            document.getElementById('make-offer').disabled = true;
            document.getElementById('offer-out').value = '';
            document.getElementById('answer-in').value = '';
            document.getElementById('apply-answer').disabled = true;
            toast.info('Screen sharing stopped.');
        }

        async function enterPiP() {
            const video = document.getElementById('share-preview');
            if (!document.pictureInPictureEnabled) return;
            try {
                await video.requestPictureInPicture();
            } catch (e) {
                console.warn(e);
            }
        }

        // --- Minimal copy-paste signaling (Sharer side) ---
        async function makeOffer() {
            if (!rtc.stream) {
                toast.warn('Start screen share first.');
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
                toast.err('Invalid Answer JSON.');
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
            toast.ok('Answer created. Send back to sharer.');
        }

        function waitForIceGathering(pc) {
            return new Promise((resolve) => {
                if (pc.iceGatheringState === 'complete') return resolve();
                function check() {
                    if (pc.iceGatheringState === 'complete') {
                        pc.removeEventListener('icegatheringstatechange', check);
                        resolve();
                    }
                }
                pc.addEventListener('icegatheringstatechange', check);
                setTimeout(() => resolve(), 2000);
            });
        }

        function init() {
            const start = document.getElementById('share-start');
            const stop = document.getElementById('share-stop');
            const pip = document.getElementById('pip-btn');

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
            if (params.get('viewer') === '1') {
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

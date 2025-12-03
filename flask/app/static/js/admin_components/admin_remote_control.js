// admin_components/remote_control.js
(function () {
    'use strict';

    // ---- Toast with fallbacks so clicks never feel "dead" ----
    const toast = {
        success: (m) => (window.Toast?.success ? Toast.success(m) : alert(m)),
        info: (m) => (window.Toast?.info ? Toast.info(m) : console.log(m)),
        warn: (m) => (window.Toast?.warning ? Toast.warning(m) : alert(m)),
        error: (m) => (window.Toast?.error ? Toast.error(m) : alert(m)),
        danger: (m) => (window.Toast?.danger ? Toast.danger(m) : alert(m)),
    };

    // ---- Config ----
    const ICE_SERVERS = (window.__ICE_SERVERS && Array.isArray(window.__ICE_SERVERS))
        ? window.__ICE_SERVERS
        : [
            { urls: ['stun:stun.l.google.com:19302'] }
            // Add TURN in prod:
            // { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }
        ];

    const state = {
        pc: null,
        remoteStream: null,
        audioMuted: false,
    };

    const els = {};

    function logLine(msg) {
        const time = new Date().toLocaleTimeString();
        if (els.log) {
            els.log.textContent += `[${time}] ${msg}\n`;
            els.log.scrollTop = els.log.scrollHeight;
        }
        console.log('[ADMIN RTC]', msg);
    }

    function setStatus(txt) {
        if (els.status) els.status.textContent = txt;
        logLine(`STATUS: ${txt}`);
    }

    function copy(text) {
        if (!text) return toast.warn('Nothing to copy');
        navigator.clipboard?.writeText(text).then(
            () => toast.success('Copied'),
            () => toast.info('Copy failed — select manually')
        );
    }

    function fsVideo() {
        const v = els.video;
        if (!v) return;
        if (document.fullscreenElement) document.exitFullscreen();
        else v.requestFullscreen?.();
    }

    function toggleMute() {
        state.audioMuted = !state.audioMuted;
        if (els.video) els.video.muted = state.audioMuted;
        if (els.btnMute) els.btnMute.textContent = state.audioMuted ? '🔈 Unmute' : '🔇 Mute';
    }

    function createPeer() {
        // cleanup old
        try { state.pc?.close(); } catch { }
        state.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 0 });

        state.remoteStream = new MediaStream();
        els.video.srcObject = state.remoteStream;

        state.pc.ontrack = (ev) => {
            const stream = ev.streams?.[0];
            if (stream) stream.getTracks().forEach(t => state.remoteStream.addTrack(t));
            setStatus('Receiving media…');
        };

        state.pc.onicecandidate = (ev) => {
            if (!ev.candidate) logLine('ICE: complete');
            else logLine(`ICE: candidate ${ev.candidate.protocol || ''}`);
        };

        state.pc.onconnectionstatechange = () => {
            const st = state.pc.connectionState;
            logLine(`PC state: ${st}`);
            if (st === 'connected') setStatus('Connected');
            if (st === 'disconnected' || st === 'failed') setStatus('Disconnected');
            if (st === 'connecting') setStatus('Connecting…');
        };

        return state.pc;
    }

    function waitIceGathering(pc) {
        return new Promise((resolve) => {
            if (pc.iceGatheringState === 'complete') return resolve();
            const check = () => {
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', check);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', check);
            // Safety timeout so UI never stalls
            setTimeout(resolve, 2500);
        });
    }

    // ===== Manual copy/paste flow =====
    async function handleManualCreateAnswer() {
        try {
            const raw = (els.offerIn.value || '').trim();
            if (!raw) {
                toast.warn('Paste an Offer first (from the user page → "Offer (send this to viewer)")');
                return;
            }

            let offer;
            try {
                offer = JSON.parse(raw);
            } catch {
                toast.error('Invalid JSON. Paste the exact Offer text (JSON) from the user page.');
                return;
            }

            if (offer.type !== 'offer' || !offer.sdp) {
                toast.error('This doesn’t look like a WebRTC Offer (missing type/sdp).');
                return;
            }

            setStatus('Setting remote offer…');
            const pc = createPeer();
            await pc.setRemoteDescription(offer);

            setStatus('Creating answer…');
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            setStatus('Gathering ICE…');
            await waitIceGathering(pc);

            const local = pc.localDescription; // includes ICE (no-trickle style)
            els.answerOut.value = JSON.stringify(local);
            toast.success('Answer ready. Copy & send back to the user.');
            setButtonsConnected(true);
        } catch (e) {
            console.error(e);
            toast.error('Failed to create Answer. See console for details.');
            setStatus('Error');
        }
    }

    // ===== Optional server join-by-code (kept here if you wire later) =====
    async function joinByCode() {
        const code = (els.codeInput.value || '').trim();
        if (!code) return toast.warn('Enter session code');

        try {
            setStatus('Fetching offer by code…');
            const res = await window.API?.postJson('/admin/webrtc/join', { code });
            if (!res?.success) throw new Error(res?.error || 'join failed');
            if (!res.data?.offer) throw new Error('No offer in response');

            const pc = createPeer();
            await pc.setRemoteDescription(res.data.offer);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await waitIceGathering(pc);

            const res2 = await window.API?.postJson('/admin/webrtc/answer', {
                code, answer: pc.localDescription
            });
            if (!res2?.success) throw new Error(res2?.error || 'answer submit failed');

            setStatus('Connecting…');
            setButtonsConnected(true);
            toast.success('Joined. Waiting for media…');
        } catch (e) {
            console.error(e);
            toast.error(e.message || 'Join failed');
            setStatus('Error');
        }
    }

    function leave() {
        try { state.pc?.close(); } catch { }
        state.pc = null;
        state.remoteStream = null;
        if (els.video) els.video.srcObject = null;
        setStatus('Idle');
        setButtonsConnected(false);
    }

    function setButtonsConnected(connected) {
        if (els.btnLeave) els.btnLeave.disabled = !connected;
        if (els.btnRetry) els.btnRetry.disabled = !connected;
    }

    function bind() {
        // Manual signaling buttons
        els.btnCreateAnswer.addEventListener('click', handleManualCreateAnswer);
        els.btnClearOffer.addEventListener('click', () => { els.offerIn.value = ''; });
        els.btnCopyAnswer.addEventListener('click', () => copy(els.answerOut.value));
        els.btnClearAnswer.addEventListener('click', () => { els.answerOut.value = ''; });

        // Server signaling buttons (no-op if you didn’t wire backend)
        els.btnJoinCode.addEventListener('click', joinByCode);
        els.btnLeave.addEventListener('click', leave);
        els.btnRetry.addEventListener('click', async () => {
            if (!state.pc) return;
            try {
                const offer = await state.pc.createOffer({ iceRestart: true });
                await state.pc.setLocalDescription(offer);
                toast.info('ICE restart attempted (requires server flow to renegotiate).');
            } catch (e) {
                console.warn(e);
            }
        });

        // Video controls
        els.btnFullscreen.addEventListener('click', fsVideo);
        els.btnMute.addEventListener('click', toggleMute);
    }

    // ===== Init hook (called by your Admin Loader) =====
    window.init_admin_remote_control = function () {
        // Cache elements safely
        els.video = document.getElementById('remoteVideo');
        els.status = document.getElementById('conn-status');
        els.log = document.getElementById('rtc-log');

        els.offerIn = document.getElementById('offer-in');
        els.answerOut = document.getElementById('answer-out');
        els.btnCreateAnswer = document.getElementById('btn-create-answer');
        els.btnClearOffer = document.getElementById('btn-clear-offer');
        els.btnCopyAnswer = document.getElementById('btn-copy-answer');
        els.btnClearAnswer = document.getElementById('btn-clear-answer');

        els.codeInput = document.getElementById('code-input');
        els.btnJoinCode = document.getElementById('btn-join-code');
        els.btnLeave = document.getElementById('btn-leave');
        els.btnRetry = document.getElementById('btn-retry');

        els.btnFullscreen = document.getElementById('btn-fullscreen');
        els.btnMute = document.getElementById('btn-mute');

        // Guard if the HTML didn't load for some reason
        if (!els.btnCreateAnswer || !els.offerIn || !els.answerOut) {
            console.error('Admin remote_control: HTML not found or not loaded yet.');
            return;
        }

        bind();
        setButtonsConnected(false);

        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            toast.warn('WebRTC requires HTTPS in production');
        }

        setStatus('Idle');
        logLine('Admin viewer ready.');
    };

    // Fallback auto-init if loader forgets to call us
    function tryInit() {
        if (document.getElementById('remote-control-admin') && !window.__remote_control_admin_inited) {
            window.__remote_control_admin_inited = true;
            window.init_admin_remote_control();
        }
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(tryInit, 0);
    } else {
        document.addEventListener('DOMContentLoaded', tryInit);
    }
})();

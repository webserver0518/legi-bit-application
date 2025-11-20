(function () {
    async function pingSession() {
        try {
            const res = await fetch("/healthz", {
                method: "GET",
                credentials: "include"
            });

            if (res.status === 401) {
                console.log("Session expired, reloading...");
                window.Toast.warning("⚠️ תוקף ההתחברות פג. אנא התחבר שוב.", { sticky: true });
                setTimeout(() => location.reload(true), 2000);
            }

        } catch (err) {
            console.log("Error pinging session:", err);
            console.warn("Ping failed", err);
        }
    }
    setInterval(pingSession, 1000);
})();

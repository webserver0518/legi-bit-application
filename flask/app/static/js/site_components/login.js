
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const formData = new FormData(form);
        const response = await fetch('/login', {
            method: 'POST',
            body: formData
        });

        if (response.redirected) {
            window.location.href = response.url;
        } else if (response.status === 401) {
            window.Toast("⛔ שם משתמש או סיסמה שגויים", "danger", { sticky: true });
        } else {
            const html = await response.text();
            document.getElementById('dynamicContent').innerHTML = html;
        }
    });
});
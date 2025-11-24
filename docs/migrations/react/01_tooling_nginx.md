# React toolchain, Bootstrap RTL, and Nginx SPA proxy

## Frontend scaffold
- React + Vite app rooted at `frontend/app/` (no backend changes).
- Bootstrap 5 RTL imported in `src/main.jsx` alongside curated legacy styles from `base_site.css` for colors, typography, and button styling.
- RTL direction is enforced at the CSS level and Hebrew labels are preserved in the starter UI.
- Sample API call in `App.jsx` uses `fetch('/api/ping', { credentials: 'include' })` to keep cookies attached.

### Dev setup
Run commands from `frontend/app/`:

- Install deps: `npm install`
- Local dev server: `npm run dev`
- Production build: `npm run build`
- Preview built assets: `npm run preview`

### Linting and formatting
Configured under `frontend/app/package.json`:
- `npm run lint` – ESLint React/JSX-a11y rules
- `npm run lint:fix` – ESLint with autofix
- `npm run format` – Prettier (JS/JSX/CSS/MD)

ESLint extends `eslint:recommended`, React hooks + a11y plugins, and disables `react/react-in-jsx-scope`. Prettier uses single quotes, print width 100, and semicolons.

### CSS imports
- `bootstrap/dist/css/bootstrap.rtl.min.css` for RTL-friendly components.
- `src/styles/legacy-base.css` copies safe tokens from `flask/app/static/css/base_site.css` (colors, typography, button accents) to preserve the brand without pulling risky globals.
- `src/styles/main.css` keeps additional RTL and layout polish for the new shell.

## Nginx SPA proxy
Both `nginx/conf/nginx.conf` and `nginx/conf/default.conf` now:
- Serve the React build from `/usr/share/nginx/html` with `try_files $uri /index.html;` for SPA fallback.
- Proxy authentication/API routes to Flask to avoid CORS and preserve cookies/Host headers: `/login`, `/logout`, `/auth/`, `/api/`.
- Forward real IP + protocol headers and keep proxy HTTP/1.1 for websocket/fetch compatibility.

Example block:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location ~ ^/(login|logout)(/.*)?$ {
        proxy_pass http://backend:9000$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://backend:9000$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://backend:9000$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Notes:
- The React build output should be copied to `/usr/share/nginx/html` before deployment (e.g., via CI/CD artifact or volume).
- All frontend fetch calls must continue to set `credentials: 'include'` so Flask session cookies survive behind the proxy.

# Docker + Nginx + ingress alignment for the React SPA

This note captures how to run the React build behind Nginx while proxying Flask auth/API routes without CORS. The compose file keeps the frontend public and the backend internal to the proxy/ingress.

## Compose topology
- `docker-compose.yml` builds two services on the `legi-bit` bridge network.
  - `backend`: builds from `./flask` (listening on 9000) and is only published for local use.
  - `nginx`: builds from the repo root using the multi-stage `nginx/Dockerfile`, serving the built React SPA from `/usr/share/nginx/html` and proxying to `backend:9000`.
- Ports: `80:80` for the SPA/proxy and `9000:9000` kept for local troubleshooting of Flask. In production you can remove the published backend port to keep it internal.
- Optional Traefik labels are stubbed in the compose file; set the real hostnames/entrypoints when deploying behind Traefik/ALB.

## Nginx behavior
- SPA fallback: `try_files $uri /index.html;` on `/` serves the React app for client-side routing.
- Proxies: `/login`, `/logout`, `/auth/`, and `/api/` forward to `backend:9000` with `Host`, `X-Forwarded-*`, and cookies preserved so sessions remain intact without CORS.
- Health: `/healthz` returns `200` for container checks.
- Compression: `gzip on;` with JS/CSS/JSON and font types enabled to reduce payload size for the SPA bundle.

## Traefik/ALB notes
- Keep the frontend and backend on the same hostname to avoid CORS and rely on cookie-based auth. Traefik rules can route hostnames to the `nginx` service on port 80; the backend stays private on the bridge network.
- If using ALB or another ingress, expose only the Nginx service and ensure sticky sessions are not required (Flask uses cookies). TLS termination should occur before Nginx so `$scheme`/`X-Forwarded-Proto` stay accurate.

## Build and run
```sh
# Build images and start the stack (React build happens in the Nginx image)
docker-compose build

docker-compose up -d

# To rebuild the SPA after code changes
docker-compose build nginx && docker-compose up -d nginx
```

The Nginx image runs the React build in a Node-based stage, then copies `/app/dist` into `/usr/share/nginx/html` for static serving alongside the proxy rules.

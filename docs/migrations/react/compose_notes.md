# docker-compose.react.yml notes

- Replaced the former `web` slot with a dedicated `frontend` service that builds from `./frontend`, exposes `80:80`, and mounts the SPA Nginx config for easy iteration while keeping the built assets baked in the image. `depends_on` now waits for the backend healthcheck to pass to avoid serving before the API is ready. 【F:docker-compose.react.yml†L4-L21】
- Backend service now builds from `./flask`, exposes `9000`, depends on Redis, and includes a healthcheck against `/alb-health` to mirror the Flask probe. 【F:docker-compose.react.yml†L20-L34】
- Added a Redis service (`redis:7-alpine`) on the shared bridge network so Flask-Session can persist sessions; default port exposed for local debugging. 【F:docker-compose.react.yml†L36-L44】
- All services share the `backend_net` bridge network to keep hostnames stable for the Nginx proxy (`backend`) without extra compose-level path hacks. 【F:docker-compose.react.yml†L18-L19】【F:docker-compose.react.yml†L42-L44】

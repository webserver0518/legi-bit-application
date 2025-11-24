# React migration audit

## Directory snapshot (2–3 levels)
- `flask/app/` → `__main__.py`, `__init__.py`, `constants/`, `managers/`, `routes/`, `services/`, `static/`, `templates/`, `scripts/`.
- `nginx/` → `Dockerfile`, `conf/` (`default.conf`, `nginx.conf`).
- `services/` → `mongodb/`, `s3/`, `elasticache/` (each has `Dockerfile`, `requirements.txt`).

## Backend entrypoint, ports, and session wiring
- Entrypoint: `python -m app` launched from `flask/app/__main__.py`; binds `0.0.0.0` with `FLASK_SERVER_PORT` default `9000` and toggles debug unless `production`. 【F:flask/app/__main__.py†L1-L24】
- Application factory sets template/static roots, loads `DevelopmentConfig` or `ProductionConfig`, and registers blueprints (`site`, `admin`, `user`). 【F:flask/app/__init__.py†L10-L45】
- Sessions: Flask-Session with Redis backend (`SESSION_TYPE=redis`, `SESSION_REDIS` from `REDIS_HOST/PORT/DB`, lifetime 1h). 【F:flask/app/managers/config.py†L6-L28】

## Auth / session endpoints and flows
- Login (`POST /login`) handles username/password with optional inline TOTP MFA, establishes `session_id` plus cookie for expiry, and redirects to `/dashboard` on success. 【F:flask/app/routes/site.py†L97-L176】
- Login loader (`GET /login`) redirects to the legacy Jinja login component; logout via `/logout` clears the login context and redirects home. 【F:flask/app/routes/site.py†L155-L168】
- Session visibility: `/auth_debug` returns the current authorization/session context for debugging (useful for SPA session checks). 【F:flask/app/routes/user.py†L15-L96】
- Health checks: `/healthz` and `/alb-health` for container and ALB checks. 【F:flask/app/routes/site.py†L25-L43】

## Data + storage endpoints relevant to frontend
- User/office context helpers: `/get_office_name`, `/get_office_serial`, `/get_username`, `/get_user_serial`, `/get_office_users`. 【F:flask/app/routes/user.py†L54-L120】
- File flows: create/update files, fetch presigned GET URLs, delete files (S3 delete + Mongo cleanup), and update descriptions. 【F:flask/app/routes/user.py†L160-L320】
- S3 upload bootstrap: `/presign/post` proxies presigned POST creation for uploads. 【F:flask/app/routes/user.py†L21-L40】

## Static/templates usage
- `create_flask_app` points `template_folder` to `flask/app/templates` and `static_folder` to `flask/app/static`; routes like `/`, `/home`, and `/load_*` render legacy Jinja templates for site/admin/user dashboards. 【F:flask/app/__init__.py†L16-L35】【F:flask/app/routes/site.py†L64-L92】

## Containerization snapshot
- Backend image: `flask/Dockerfile` installs Python deps, copies `app/`, exposes 9000, adds curl healthcheck, and starts with `python -m app`. 【F:flask/Dockerfile†L1-L27】
- Existing Nginx image proxies all traffic to `backend:9000` (no SPA fallback) per `nginx/conf/default.conf` (duplicated as `nginx.conf`). 【F:nginx/conf/default.conf†L1-L18】
- Microservice stubs exist for MongoDB, S3, and ElastiCache under `services/*` with their own Dockerfiles.

## Gaps / risks
- Frontend currently tied to Jinja loaders (`/load_login`, `/load_home`, admin/user base templates), so SPA must replace template rendering paths or keep compatibility routes during transition. 【F:flask/app/routes/site.py†L73-L92】【F:flask/app/routes/user.py†L46-L52】
- Existing Nginx config lacks SPA routing (no `try_files`) and forwards everything to backend; a new SPA proxy/fallback is required. 【F:nginx/conf/default.conf†L3-L18】
- Session introspection relies on `/auth_debug`; no dedicated JSON session status endpoint beyond that debug route. 【F:flask/app/routes/user.py†L15-L19】
- Redis-backed sessions require `SECRET_KEY` and Redis host env vars; compose must ensure Redis is available before backend starts. 【F:flask/app/managers/config.py†L6-L28】

# React migration layout scan

- **Current branch:** `react` (created from existing work branch for React migration documentation only).
- **Flask entrypoints:**
  - `flask/app/__main__.py` starts the Flask dev server via `create_flask_app` with host `0.0.0.0` and port `FLASK_SERVER_PORT` defaulting to `9000`.
  - `flask/app/__init__.py` builds the Flask app, applies config (production vs development), sets up `Session`, configures logging, registers `site`, `admin`, and `user` blueprints, and applies a no-cache `after_request` hook.
- **Routes/blueprints under `flask/app/routes/`:** `site.py`, `admin.py`, `user.py`.
- **Managers under `flask/app/managers/`:** `response_management.py`, `mfa_manager.py`, `auth_management.py`, `config.py`, `formatter_management.py`, `json_management.py` (covering response handling, MFA, auth/config/logging helpers).
- **Legacy Flask assets:**
  - Static files rooted at `flask/app/static/` with `css/`, `images/`, and `js/` subdirectories.
  - Templates under `flask/app/templates/` including shared bases (`base_site.html`, `base_admin_dashboard.html`, `base_user_dashboard.html`) and component folders (`admin_components/`, `site_components/`, `user_components/`).
- **Frontend/React presence:** No dedicated frontend or React directories (`frontend/`, `app/`, `package.json`) detected in repo root or immediate subdirectories; React scaffold absent.
- **Nginx configuration:**
  - `nginx/conf/default.conf` and `nginx/conf/nginx.conf` define an HTTP server listening on port 80/IPv4+IPv6 proxying all paths to `http://backend:9000/` and hiding `Date`/`Server` headers; no static file mounts present.
- **Infrastructure/compose notes:**
  - No docker-compose file at repo root.
  - Service directories under `services/`: `elasticache/`, `mongodb/`, `s3/`, each with a `Dockerfile`, `app/`, and `requirements.txt` (per-service container setup).


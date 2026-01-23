# Legibit App

This repository defines a containerized stack for the Legibit web application.

## Architecture Overview

- **Flask application** (`flask/`)
  - Provides the HTTP API and server-rendered pages.
  - Structured into modular packages for constants, data seeds, managers, routes, background scripts, and service integrations.
  - Static assets and templates live under `flask/app/static/` and `flask/app/templates/` respectively, but the focus of this project is on the backend services that expose and orchestrate Legibit features.

- **Nginx gateway** (`nginx/`)
  - Acts as the front-facing reverse proxy, routing external traffic to the Flask application and handling TLS/static delivery concerns.

- **MongoDB microservice** (`mongodb/`)
  - Exposes API endpoints used by the Flask app for persistence operations.
  - Contains its own application package with connection managers and formatters dedicated to MongoDB.

- **S3-compatible storage microservice** (`s3/`)
  - Wraps interactions with an object store (e.g., AWS S3 or MinIO) that the Flask layer uses for file management.

- **SES-compatible email microservice** (`ses/`)
  - Wraps interactions with an email service that the Flask layer uses for sending emails.

## Docker Composition

Each component is containerized with its own `Dockerfile`:

- `flask/Dockerfile`
- `nginx/Dockerfile`
- `mongodb/Dockerfile`
- `s3/Dockerfile`
- `ses/Dockerfile`

These images are meant to be orchestrated together.

## Monitoring

Local development includes an optional monitoring stack powered by **Prometheus** and **Grafana**.

- **Prometheus** (`prometheus`)
  - Scrapes `/metrics` endpoints from the Legibit services based on `./prometheus/prometheus.yaml`.
  - Exposes the Prometheus UI on `http://localhost:9090`.
  - Persists time-series data using the `prometheus-data` volume (keeps metrics history across container restarts).

- **Grafana** (`grafana`)
  - Uses Prometheus as a data source for dashboards and visualizations.
  - Exposes the Grafana UI on `http://localhost:3000`.
  - Default credentials:
    - Username: `admin`
    - Password: `admin`
  - Persists dashboards, users, and data source configuration using the `grafana_data` volume.

Prometheus scraping is configured via `./prometheus/prometheus.yaml` with a global `scrape_interval` of `5s` and the following jobs:
- `backend_app` → `backend:9000`
- `ses_service` → `service-ses:8002`
- `s3_service` → `service-s3:8000`


## Local Development

1. Build image:
   ```bash
   cd local_deploy
   docker compose build
   ```
2. add the secrets folder with aws creds and env files for each deployment.
2. Run the containers with docker desktopL:
   ```bash
   docker compose up -d
   ```

## Production

see [infra repo](https://github.com/webserver0518/legi-bit-infrastructure)
for more details.

## Best Practices

- Microservices Architecture
- Small docker images
- filtering in build workflow
- Applicative metrics

## License

This project is licensed under the terms described in [`LICENSE`](LICENSE).
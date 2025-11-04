# Legibit App

This repository defines a containerized stack for the Legibit web application.

## Architecture Overview

- **Flask application** (`flask/`)
  - Provides the HTTP API and server-rendered pages.
  - Structured into modular packages for constants, data seeds, managers, routes, background scripts, and service integrations.
  - Static assets and templates live under `flask/app/static/` and `flask/app/templates/` respectively, but the focus of this project is on the backend services that expose and orchestrate Legibit features.

- **MongoDB microservice** (`services/mongodb/`)
  - Exposes API endpoints used by the Flask app for persistence operations.
  - Contains its own application package with connection managers and formatters dedicated to MongoDB.

- **S3-compatible storage microservice** (`services/s3/`)
  - Wraps interactions with an object store (e.g., AWS S3 or MinIO) that the Flask layer uses for file management.

- **Nginx gateway** (`nginx/`)
  - Acts as the front-facing reverse proxy, routing external traffic to the Flask application and handling TLS/static delivery concerns.

## Docker Composition

Each component is containerized with its own `Dockerfile`:

- `flask/Dockerfile` builds the Flask application image.
- `services/mongodb/Dockerfile` builds the MongoDB-facing API service.
- `services/s3/Dockerfile` builds the S3 helper service.
- `nginx/Dockerfile` assembles the reverse proxy image with configuration from `nginx/conf/`.

These images are meant to be orchestrated together (e.g., via `docker compose`) to provide a full stack where the gateway fronts the Flask API, which in turn coordinates with the MongoDB and S3 helper services.

## Local Development

1. Build each image:
   ```bash
   docker build -t legibit-flask ./flask
   docker build -t legibit-mongodb-service ./services/mongodb
   docker build -t legibit-s3-service ./services/s3
   docker build -t legibit-nginx ./nginx
   ```
2. Run the containers with your preferred orchestration tool, ensuring the Flask app can reach the MongoDB and S3 services, and that Nginx proxies to the Flask container.

## License

This project is licensed under the terms described in [`LICENSE`](LICENSE).
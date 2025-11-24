# Dockerfile.nginx

FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY frontend/app/package*.json ./
RUN npm install --no-audit --progress=false
COPY frontend/app ./
RUN npm run build

FROM nginx:1.25.5-alpine

# Add curl for healthcheck
RUN apk add --no-cache curl

# Copy your Nginx configuration directly into the image
COPY conf/nginx.conf /etc/nginx/conf.d/default.conf

# Ship the built React SPA
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Healthcheck baked in
HEALTHCHECK CMD curl -fs http://localhost/healthz || exit 1

# Nginx runs automatically on container start

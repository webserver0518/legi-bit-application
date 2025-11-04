# Dockerfile.nginx
FROM nginx:1.25.5-alpine

# Add curl for healthcheck
RUN apk add --no-cache curl

# Copy your Nginx configuration directly into the image
# Assuming your file is ./nginx/conf/nginx.conf
COPY conf/nginx.conf /etc/nginx/conf.d/default.conf

# Healthcheck baked in
HEALTHCHECK CMD curl -fs http://localhost/healthz || exit 1

# Nginx runs automatically on container start

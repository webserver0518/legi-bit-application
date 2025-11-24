# Dockerfile.flask
FROM python:3.11-slim

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Prevent Python from writing pyc files and enable unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy dependency list and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source code
COPY app ./app

# Optional: expose the Flask port
EXPOSE 9000

# Healthcheck baked in
HEALTHCHECK CMD curl -fsS http://localhost:9000/healthz || exit 1

# Start the backend
CMD ["python", "-m", "app"]

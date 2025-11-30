# Dockerfile.service-mongodb
FROM python:3.11-slim

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r requirements.txt

# Optional: add curl for healthcheck debugging
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1

EXPOSE 8002
CMD ["python", "-m", "app"]

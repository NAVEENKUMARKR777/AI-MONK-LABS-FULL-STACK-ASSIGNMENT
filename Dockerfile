# Single-image deployment for the Nested Tags Tree app.
#
# Layout inside the runtime container:
#   /app             FastAPI source + SQLite file
#   /app/dist        built React assets
#   /usr/local/bin/  caddy binary, copied from the official image
#
# Caddy listens on $PORT and:
#   - reverse-proxies /api/* (prefix stripped) to 127.0.0.1:$BACKEND_INTERNAL_PORT
#   - serves /app/dist with SPA fallback for everything else
#
# uvicorn runs in the background; Caddy is the foreground process.

# ---- frontend build ---------------------------------------------------------
FROM node:20-alpine AS fe-build
WORKDIR /fe

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# ---- caddy binary -----------------------------------------------------------
FROM caddy:2-alpine AS caddy-bin

# ---- runtime ---------------------------------------------------------------
FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    BACKEND_INTERNAL_PORT=8000

COPY --from=caddy-bin /usr/bin/caddy /usr/local/bin/caddy

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=fe-build /fe/dist ./dist

COPY Caddyfile /etc/caddy/Caddyfile
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
CMD ["/entrypoint.sh"]

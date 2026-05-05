#!/usr/bin/env bash
set -euo pipefail

# Persist SQLite via /data when a Railway Volume is mounted there.
# Symlinking lets us keep main.py / database.py untouched (they write ./trees.db).
if mkdir -p /data 2>/dev/null; then
    ln -sf /data/trees.db /app/trees.db
fi

# Background: FastAPI on the loopback. Foreground: Caddy on $PORT.
uvicorn main:app \
    --host 127.0.0.1 \
    --port "${BACKEND_INTERNAL_PORT:-8000}" \
    &
UVICORN_PID=$!

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!

# Forward INT/TERM to children, and exit if either dies.
shutdown() {
    kill -TERM "$UVICORN_PID" "$CADDY_PID" 2>/dev/null || true
    wait "$UVICORN_PID" "$CADDY_PID" 2>/dev/null || true
    exit 0
}
trap shutdown INT TERM

wait -n "$UVICORN_PID" "$CADDY_PID"
EXIT_CODE=$?
shutdown
exit "$EXIT_CODE"

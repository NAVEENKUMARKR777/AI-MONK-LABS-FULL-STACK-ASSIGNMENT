#!/usr/bin/env bash
# -e is intentionally off: 'wait -n' returning non-zero is normal when a
# child crashes, and we want to log which one before exiting.
set -uo pipefail

UDS_PATH="/tmp/uvicorn.sock"

echo "[entrypoint] PORT=${PORT:-<unset>}"

# Persist SQLite via /data when a Railway Volume is mounted there.
if mkdir -p /data 2>/dev/null && touch /data/.w 2>/dev/null; then
    rm -f /data/.w
    ln -sf /data/trees.db /app/trees.db
    echo "[entrypoint] SQLite -> /data/trees.db (persistent volume)"
else
    echo "[entrypoint] /data not writable; SQLite stays on ephemeral fs"
fi

rm -f "$UDS_PATH"

echo "[entrypoint] starting uvicorn on unix:$UDS_PATH"
uvicorn main:app --uds "$UDS_PATH" --log-level info &
UVICORN_PID=$!

# Wait up to 10s for the socket to appear before launching Caddy, so the
# first /api requests don't 502 due to a startup race.
for _ in $(seq 1 20); do
    [ -S "$UDS_PATH" ] && { echo "[entrypoint] uvicorn socket ready"; break; }
    sleep 0.5
done

echo "[entrypoint] starting caddy on :${PORT:-8080}"
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!

shutdown() {
    echo "[entrypoint] shutting down (uvicorn=$UVICORN_PID caddy=$CADDY_PID)"
    kill -TERM "$UVICORN_PID" "$CADDY_PID" 2>/dev/null || true
    wait "$UVICORN_PID" "$CADDY_PID" 2>/dev/null || true
}
trap shutdown INT TERM EXIT

wait -n "$UVICORN_PID" "$CADDY_PID"
EXIT_CODE=$?

if ! kill -0 "$UVICORN_PID" 2>/dev/null; then
    echo "[entrypoint] uvicorn exited (code=$EXIT_CODE) — see traceback above"
fi
if ! kill -0 "$CADDY_PID" 2>/dev/null; then
    echo "[entrypoint] caddy exited (code=$EXIT_CODE) — see error above"
fi

exit "$EXIT_CODE"

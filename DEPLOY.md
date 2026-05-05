# Deployment — Railway (single container) + GitHub Actions

One Docker image containing the React build, FastAPI backend, and a Caddy
front door — deployed as a single Railway service.

```
                      Public traffic on $PORT
                              │
                              ▼
                          ┌────────┐
                          │ Caddy  │   serves /app/dist  (SPA fallback)
                          │        │   reverse-proxies /api/* ─────┐
                          └────────┘                                │
                                                                    ▼
                                                       127.0.0.1:8000 uvicorn
                                                       (main:app, SQLite at
                                                        /data/trees.db via
                                                        symlink)
```

No application source files were modified for production. The integration
lives entirely in deployment artefacts at the repo root: `Dockerfile`,
`Caddyfile`, `entrypoint.sh`, `railway.json`, `.dockerignore`.

## 1. Push to GitHub

This directory is not a git repo yet. From the project root:

```powershell
git init -b main
git add .
git commit -m "Initial commit: Nested Tags Tree full stack"

# Create the GitHub repo first, then:
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 2. Create the Railway service

1. **New Project → Deploy from GitHub repo**, select your repo.
2. Railway picks up `railway.json` and builds with the root `Dockerfile` —
   no Root Directory or Start Command to configure.
3. **Variables**: nothing required. Railway injects `$PORT`; the entrypoint
   uses it.
4. **Volumes**: add a Volume mounted at `/data`. The entrypoint symlinks
   `./trees.db → /data/trees.db`, so the SQLite file survives redeploys.
   *Without a volume the DB is wiped on every deploy.*
5. **Networking → Generate Domain** → that's the public URL. Open it: the
   React app loads, hits `/api/*` on the same origin, Caddy forwards to
   uvicorn.

## 3. Local Docker run (verify before pushing)

Build and run the same image you ship to Railway:

```powershell
docker build -t nested-tags-tree .
docker run --rm -p 8080:8080 -v ${PWD}/.localdata:/data nested-tags-tree
```

Then open <http://localhost:8080>. The volume mount mimics Railway's
persistence locally (DB file lands in `.localdata/trees.db`).

This image was smoke-tested during setup:

```text
$ curl http://localhost:8080/api/trees
[]
$ curl -X POST http://localhost:8080/api/trees \
       -H "Content-Type: application/json" \
       -d '{"tree":{"name":"root","children":[{"name":"c1","data":"hello"}]}}'
{"id":1,"tree":{...},"created_at":"...","updated_at":"..."}
$ curl http://localhost:8080/   # → React index.html
```

## 4. GitHub Actions CI

`.github/workflows/ci.yml` runs on every push / PR to `main`:

| job        | what it does                                              |
|------------|-----------------------------------------------------------|
| `backend`  | installs `requirements.txt`, runs a `TestClient` CRUD smoke test against `main:app` |
| `frontend` | `npm ci && npm run build`, uploads `dist/` as an artifact |
| `docker`   | builds the combined image with build cache, boots it, probes `/api/trees` and `/` |

No deploy step in CI — Railway's GitHub integration auto-deploys each push
to `main`. Toggle in **Service → Settings → Source → Auto Deploy**.

## How the integration works without source changes

- **API prefix:** the React app calls `/api/*` (the dev proxy in
  `vite.config.js` already uses this prefix). In production Caddy is
  configured with `handle_path /api/*` which strips the prefix and
  reverse-proxies to uvicorn — so `/api/trees` on the browser becomes
  `GET /trees` on FastAPI.
- **SQLite path:** `database.py` writes `./trees.db`. The entrypoint
  symlinks that path to `/data/trees.db`; SQLite follows symlinks
  transparently and writes through to the persistent volume.
- **Port binding:** uvicorn listens on `127.0.0.1:8000` (private). Caddy
  is the only process bound to `$PORT` (Railway's public port).

## Local dev (unchanged)

`npm run dev` + `uvicorn main:app --reload --port 8000` still work exactly
as in [README.md](README.md). Vite's dev proxy handles `/api/*` locally;
the Docker image is only used in production (or for verifying the prod
build before push).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Image builds but `/api/trees` returns 502 | uvicorn crashed during boot — `docker logs <id>` will show the Python traceback. |
| Data wiped after each Railway deploy | No Volume mounted at `/data`. |
| `pydantic-core` build fails on CI | Don't bump the workflow Python past 3.12 unless `requirements.txt` is loosened to floors. |
| Container exits immediately | `entrypoint.sh` line endings — ensure LF, not CRLF (`.gitattributes` or `dos2unix`). |
| Port mismatch locally | Container listens on `$PORT` (default 8080); pass `-e PORT=9000 -p 9000:9000` to override. |
| 404 on deep refresh of a SPA route | Caddy already handles SPA fallback (`try_files {path} /index.html`); if you see this, confirm the build copied `dist/` correctly. |

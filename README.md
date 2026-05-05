# Nested Tags Tree — Full Stack

A full-stack implementation of the AIMonk coding assignment.

- **Frontend:** React 18 + Vite — recursive `TagView` component with collapse, add-child, rename-on-click, and editable data fields.
- **Backend:** FastAPI + SQLAlchemy + SQLite — `GET`/`POST`/`PUT`/`DELETE /trees`.
- **Storage:** SQLite (`backend/trees.db` locally; `/data/trees.db` on Railway via volume).
- **Deployment:** single Docker image (Caddy + uvicorn + React build) targeted at Railway. CI via GitHub Actions. See [DEPLOY.md](DEPLOY.md).

## Project structure

```
.
├── backend/
│   ├── main.py              # FastAPI app + routes
│   ├── models.py            # SQLAlchemy Tree model
│   ├── schemas.py           # Pydantic models (recursive TagNode)
│   ├── database.py          # Engine + session
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   ├── vite.config.js       # dev server :8080, proxies /api → :8000
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles.css
│       └── components/TagView.jsx
├── Dockerfile               # multi-stage: node build + python runtime + caddy
├── Caddyfile                # serves /app/dist, proxies /api/* to uvicorn
├── entrypoint.sh            # boots uvicorn + caddy, symlinks SQLite to /data
├── railway.json             # Railway → use Dockerfile builder
├── .dockerignore
├── .github/workflows/ci.yml # backend smoke test + frontend build + docker probe
├── DEPLOY.md                # Railway + GitHub Actions walkthrough
└── README.md
```

## Running locally (dev mode)

Two terminals — the Vite dev server proxies `/api/*` to uvicorn so you get
hot reload on both halves.

### Backend (FastAPI on :8000)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1        # PowerShell
# .venv\Scripts\activate.bat      # cmd
# source .venv/bin/activate       # bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Browse <http://localhost:8000/docs> for interactive API docs.

### Frontend (Vite on :8080)

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:8080>. The dev server proxies `/api/*` to the backend.

## Running locally (production image)

Same image as Railway runs — useful for verifying the full build:

```powershell
docker build -t nested-tags-tree .
docker run --rm -p 8080:8080 -v ${PWD}/.localdata:/data nested-tags-tree
```

Open <http://localhost:8080>. SQLite persists to `.localdata/trees.db`.

## Deploying

See [DEPLOY.md](DEPLOY.md) for the full Railway walkthrough. TL;DR:

1. Push the repo to GitHub.
2. Railway → New Project → Deploy from GitHub repo (auto-detects `railway.json`).
3. Add a Volume mounted at `/data`.
4. Generate a domain.

CI (`.github/workflows/ci.yml`) runs on every push/PR to `main`: backend
TestClient CRUD smoke test, frontend Vite build, and a combined Docker
image build that boots the container and probes `/api/trees` + `/`.

## REST API

| Method | Path                | Body                           | Response               |
|--------|---------------------|--------------------------------|------------------------|
| GET    | `/trees`            | —                              | `TreeOut[]`            |
| GET    | `/trees/{id}`       | —                              | `TreeOut`              |
| POST   | `/trees`            | `{ "tree": TagNode }`          | `TreeOut` (201)        |
| PUT    | `/trees/{id}`       | `{ "tree": TagNode }`          | `TreeOut`              |
| DELETE | `/trees/{id}`       | —                              | 204                    |

`TagNode` shape (recursive, mutually-exclusive `children` / `data`):

```json
{
  "name": "root",
  "children": [
    { "name": "child1", "children": [
      { "name": "child1-child1", "data": "c1-c1 Hello" }
    ]},
    { "name": "child2", "data": "c2 World" }
  ]
}
```

In production the React app calls `/api/*` on its own origin and Caddy
strips the prefix before forwarding to FastAPI — so `/api/trees` in the
browser hits `GET /trees` on uvicorn.

## Database schema

A single table `trees` storing the JSON payload as text — appropriate
because the tree is consumed/produced as a unit; recursive CTE joins across
an adjacency-list table would add complexity without payoff at this scope.

| column      | type      | notes                          |
|-------------|-----------|--------------------------------|
| id          | INTEGER   | PK, autoincrement              |
| payload     | TEXT      | canonical JSON (`name`, `children`/`data`) |
| created_at  | DATETIME  | server default `now()`         |
| updated_at  | DATETIME  | auto-updated on save           |

## Frontend behaviour

- **Initial load:** `GET /trees` — if empty, the default sample tree from the assignment is rendered as an unsaved card.
- **Collapse / expand:** every tag (including `root`) toggles between `v` and `>`.
- **Add Child:** appends to existing `children`, or replaces `data` with a `children` array containing a single `{ name: "New Child", data: "Data" }`.
- **Rename:** click the name to edit; **Enter** commits, **Esc** cancels.
- **Edit data:** typing in the data field mutates the tree state.
- **Export:** prints the sanitized JSON (only `name` / `children` / `data`) and persists — `POST` for unsaved trees, `PUT` for existing ones.
- **Multiple trees:** each saved record renders as its own card; "+ New Tree" adds a blank one.

## Notes on choices

- Frontend port `8080` and backend port `8000` follow the screenshot in the assignment.
- CORS is wide-open in `main.py` — fine for this scope; in production traffic is same-origin via Caddy anyway.
- SQLite chosen so the project runs with zero external services; swap the URL in `database.py` for Postgres/MySQL with no other code changes.
- Single-container deploy keeps the surface minimal — one Railway service, one URL, no inter-service config.

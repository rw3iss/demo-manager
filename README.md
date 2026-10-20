# demo-manager

Publish static "demo" sites and their versions, and manage them from a sleek
admin dashboard. One small NestJS process serves the admin UI, the admin API,
**and** the demos themselves; one nginx vhost fronts the whole thing.

Live (prod): **https://demos.ryanweiss.net** (alias **https://demos.rw3iss.com**) · manager at **/manage**.

---

## How it works

- A **project** is a named demo with a URL **slug**. It has N **versions** (zip
  uploads). One version is the **current** one (not necessarily the latest).
- Visit a project at its slug; pin a specific version by number:

  | URL | Serves |
  |---|---|
  | `https://demos.ryanweiss.net/<slug>/` | **302 →** the current version's `/<slug>/<n>/` URL |
  | `https://demos.ryanweiss.net/<slug>/<n>/` | **version `n`** specifically |
  | `https://demos.ryanweiss.net/manage` | the **admin dashboard** |

  The bare project root redirects (302) to the current version's URL rather than
  serving it in place, so each demo has one canonical URL per version (the
  comment widget then registers a single page, not a duplicate for the root).

- A version is published from **either a `.zip` or a single `.html`/`.htm` file**.
  A lone html file is stored as the version's `index.html`. A zip must contain an
  `index.html` at its root — or a single `.html`/`.htm` file (renamed to
  `index.html`); a single wrapping folder is unwrapped automatically, and zero or
  multiple root html files is an error.
- Each uploaded demo is served as an **SPA**: deep links fall back to its
  `index.html`, and a `<base href>` is injected so **relative** asset paths work
  under the subpath. Build your demo with a relative base (`vite build --base ./`,
  CRA `"homepage": "."`, etc.).
- The app reads which project/version is **enabled** and **current** from
  Postgres on each request, so **adding a project needs no nginx change**.
- **Comments (optional):** enable "Comments" on a project (with a PageLoop
  project id) and the [PageLoop](https://pageloop.ryanweiss.net) widget is baked
  into every published page for in-page commenting. Toggling the setting applies
  to all existing versions too — enabling re-injects the widget across every
  version, disabling strips it. Configured per project in the New Project /
  Settings modal; endpoint via `PAGELOOP_ENDPOINT`.

```
nginx (demos.ryanweiss.net)  →  demo-manager (NestJS, :4090 prod / :8092 dev)
                                 ├─ /api/v1/*   admin API
                                 ├─ /manage/*   admin SPA (Preact)
                                 └─ /<slug>/..   static demos from DEMOS_ROOT
                                      │
                            Postgres (metadata) + /var/lib/demo-manager/demos
```

---

## Repo layout

| Path | What |
|---|---|
| `server/` | NestJS API + static/demo serving (`src/…`, TypeORM, migrations) |
| `client/` | Preact admin SPA (Vite, built to `client/dist`, served at `/manage`) |
| `deploy/` | systemd unit + nginx vhost |
| `scripts/` | `deploy.sh`, `update.sh`, `setup-server.sh`, `demo` (CLI) |
| `docs/` | `ARCHITECTURE.md` (design), `API.md` (endpoints) |

---

## Local development

Needs Node ≥ 22.18 and a Postgres. Point the server at any database:

```bash
# 1) server (port 8092) — set DB_* in server/.env (copy from .env.example)
cd server
cp .env.example .env            # then edit DB_USER / DB_PASSWORD / DB_NAME
npm install
npm run migration:run           # or set DB_SYNCHRONIZE=true for quick dev
npm run dev

# 2) client (port 5173, proxies /api → :8092)
cd ../client
npm install
npm run dev
```

Open **http://localhost:5173/manage/**. (Or build the client and open
`http://localhost:8092/manage/` — the server serves the built bundle.)

---

## Publishing a demo

**From the UI:** open a project, drag a `.zip` onto the dropzone, confirm the
version name + "promote to current" toggle, and publish.

**From the CLI** (`scripts/demo`, uses `curl`/`jq`):

```bash
export DEMO_API=https://demos.ryanweiss.net
scripts/demo create "Acme Redesign" --slug acme
scripts/demo publish acme ./build.zip --name "Q2 homepage"   # promotes by default
scripts/demo publish acme ./build.zip --no-promote           # upload without promoting
scripts/demo promote acme 3
scripts/demo disable acme 2     # hide a version publicly
scripts/demo rm acme 2          # delete a version
scripts/demo rm acme            # delete the project + all versions
scripts/demo projects | jq      # list
```

---

## Deploying

Hosted on the ryanweiss.net box as a native systemd service behind nginx
(`127.0.0.1:4090`). See `CLAUDE.md` for server paths and operations.

```bash
git push                        # the server deploys origin/main
bash scripts/deploy.sh          # SSH → update.sh: pull → build → host config → restart → health-check
```

Or push to `main` — `.github/workflows/deploy.yml` runs the same (needs the
`SSH_PRIVATE_KEY` repo secret; skips without it).

---

## Notes

- **Auth:** routes are public for now; an auth seam is designed in (see
  `docs/ARCHITECTURE.md` §9) to gate `/api` + `/manage` and optionally demos.
- **Money/time conventions:** timestamps are Unix epoch seconds (platform-wide).
- **Don't hand-edit** generated `dist/`; rebuild from `src/`.

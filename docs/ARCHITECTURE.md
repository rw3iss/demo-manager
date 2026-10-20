# demo-manager — Architecture & Plan

> Status: **design + initial build**. This document is the source of truth for *why* the
> system is shaped the way it is. For *how to run/deploy it*, see `README.md` and `CLAUDE.md`.

A small, self-hostable system for publishing static "demo" sites and their versions, with a
sleek admin client to manage them. One backend process serves both the admin UI and the public
demos; one nginx vhost fronts the whole thing.

---

## 1. Goals & non-goals

**Goals**

- Register **projects** (a named static demo) and publish **versions** of each (zip uploads).
- Serve any project's **current** version at `https://demos.ryanweiss.net/<slug>/` and a specific
  version at `https://demos.ryanweiss.net/<slug>/<n>/`.
- Each uploaded demo is a self-contained **SPA**: deep links fall back to its `index.html`,
  relative asset paths resolve from wherever it was unpacked.
- A clean admin dashboard: every project as a column, its versions listed newest-first; a project
  detail page to upload, promote, disable, and delete versions or the whole project.
- Drag-drop zip upload with a confirmation **modal** (name/description, computed next version,
  zip size, and a "promote to current" toggle that defaults on).
- Errors surface cleanly in the UI (validation, upload, permission, server).
- Clean REST API designed so the same operations can later be driven from a **CLI**.
- Deployable to the server as a **native systemd service** (no Docker for our app),
  reusing the box's existing Postgres and nginx.

**Non-goals (for now)**

- Authentication / authorization. Routes are public; an auth seam is designed in (§9) so the
  whole site or individual projects can be gated later.
- Multi-node / horizontal scale, CDN, build pipelines for demos. Demos are pre-built static
  bundles uploaded as zips.
- Real-time anything. No websockets, no queues.

---

## 2. High-level shape

```
                          https://demos.ryanweiss.net
                                     │
                          ┌──────────▼───────────┐
                          │  rw-nginx (docker)  │   one vhost, TLS termination
                          │  demos.ryanweiss.net  │   proxy_pass → host 172.20.0.1:8092
                          └──────────┬───────────┘
                                     │  (all paths)
                       ┌─────────────▼──────────────┐
                       │   demo-manager (NestJS)     │  native systemd service on the host
                       │   bind 0.0.0.0:8092         │
                       │                             │
                       │  /api/v1/*  → JSON API      │  projects, versions, upload
                       │  /healthz   → health        │
                       │  /manage/*  → admin SPA     │  Preact bundle (static, SPA fallback)
                       │  /          → 302 /manage   │
                       │  /<slug>/.. → demo serving  │  static files from DEMOS_ROOT, SPA fallback
                       └─────────────┬───────────────┘
                                     │
                ┌────────────────────┼─────────────────────┐
                │                    │                      │
        ┌───────▼────────┐   ┌───────▼────────┐    ┌────────▼─────────┐
        │  postgres      │   │  DEMOS_ROOT    │    │  client/dist     │
        │  db: demo_     │   │  /opt/demos/   │    │  (manager SPA)   │
        │  manager       │   │  <slug>/<n>/.. │    │  served at /manage│
        └────────────────┘   └────────────────┘    └──────────────────┘
```

**One process, three responsibilities**, separated internally but deployed as a single unit:

1. **Admin API** (`/api/v1`) — CRUD for projects & versions, zip upload. NestJS controllers +
   services + TypeORM. Standard response envelope + global exception filter.
2. **Manager UI** (`/manage`) — the Preact admin client, built to a static bundle and served by
   the same process with SPA fallback. (The user explicitly OK'd serving it "like the others" as a
   static bundle rather than a second running app — fewer moving parts.)
3. **Public demo serving** (`/<slug>/…`) — resolves slug → project, optional version, file; streams
   static files from `DEMOS_ROOT`; injects `<base href>` and falls back to the demo's `index.html`
   for SPA routes.

Why one process: the user wants "one nginx entry for the main demo site" with the controller app
orchestrating which folder/version to serve. nginx stays dumb (a single reverse proxy); all routing
intelligence lives in the app, which can read the DB to decide what's enabled/current. Adding a new
project requires **zero** nginx changes.

---

## 3. URL & routing model

nginx proxies **everything** for `demos.ryanweiss.net` to the app. The app dispatches by path, in
this precedence (most specific first):

| Path pattern              | Handler            | Notes                                              |
|---------------------------|--------------------|----------------------------------------------------|
| `/api/v1/**`              | Nest controllers   | JSON API                                           |
| `/healthz`                | Nest controller    | liveness/readiness                                 |
| `/manage`, `/manage/**`   | Manager static     | admin SPA, base `/manage/`, fallback `index.html`  |
| `/` (exact)               | redirect           | `302 → /manage`                                    |
| `/<slug>`                 | redirect           | `301 → /<slug>/` (normalize trailing slash)        |
| `/<slug>/**`              | Demo serving       | the catch-all; runs last                           |

The API/health routes are Nest controllers (registered first). The static/demo serving is a single
catch-all handler attached to the underlying Express instance **after** Nest registers its routes,
so controller routes always win and the catch-all only sees what's left. This avoids wildcard route
shadowing and keeps the JSON API on Nest's DI/validation/filter stack.

**Reserved slugs** (rejected at project creation): `api`, `manage`, `admin`, `healthz`, `health`,
`assets`, `static`, `_next`, `favicon.ico`, `robots.txt`, `.well-known`.

### 3.1 Resolving a demo request `/<slug>/<rest…>`

1. Look up project by `slug`. Missing or `enabled=false` → styled **404** page.
2. Decide the version:
   - Split `rest`. If the **first segment is a pure integer** matching an existing **enabled**
     version `number` of this project → that's the pinned version; the asset path is the remaining
     segments; the page **base** is `/<slug>/<n>/`.
   - Otherwise → use the project's **current** version. The **bare project root** (`/<slug>` or
     `/<slug>/`, i.e. empty `rest`) is just a pointer to that version, so it returns a **302
     redirect** to the canonical `/<slug>/<n>/` URL (`Cache-Control: no-store`, since "current" is
     mutable — never a permanent 301). This gives each demo one canonical URL per version, so the
     comment widget registers a single page instead of a duplicate for the root. A non-empty
     non-pinned path still serves the current version in place (asset path = entire `rest`, base
     `/<slug>/`).
   - No current version (or current is disabled) → styled **404** ("no published version").
3. Resolve the file at `DEMOS_ROOT/<slug>/<versionNumber>/<assetPath>` (default `index.html`).
   - **Path-traversal guard:** the resolved real path must stay within the version directory.
   - File exists → stream it with the right `Content-Type`. Hashed assets (e.g. under `assets/`)
     get long-lived immutable caching; `index.html` is sent `no-cache`.
   - File missing **and** the request looks like navigation (`Accept: text/html` or no file
     extension) → serve the version's `index.html` (SPA fallback) with an injected `<base>`.
   - Otherwise → 404.

**`<base href>` injection** is what makes an arbitrary subpath work for relative-path SPAs: we
insert `<base href="/<slug>/[<n>/]">` right after `<head>` (replacing any existing `<base>`). A demo
built with a relative base (`vite build --base ./`, CRA `"homepage": "."`, etc.) then resolves
`./assets/app.js` and client-side routes correctly under its subpath. This is the one requirement we
place on uploaded demos, and it's documented in the UI and README. (Demos hard-coded to absolute
`/assets/...` paths are out of scope — rebuild them with a relative base.)

### 3.2 Why integer version refs

The user's URL scheme is `/<slug>/` (current) and `/<slug>/2` (version 2). Versions get a
per-project sequential **`number`** (1, 2, 3 …) which is the public ref. We only treat the first
segment as a version when it's a bare integer that matches a real version, so a demo's own routes
(`/about`, `/items/5`) are unaffected. Edge case — a demo with a top-level route that is itself a
bare integer colliding with a version number — is documented and acceptable for design demos.

---

## 4. Data model

Two tables. Timestamps are **Unix epoch seconds** (platform convention). Money is irrelevant here.

**project**

| column              | type        | notes                                             |
|---------------------|-------------|---------------------------------------------------|
| `id`                | uuid (pk)   |                                                   |
| `slug`              | varchar uq  | URL key, lowercase kebab, validated + reserved-checked |
| `name`              | varchar     | display name                                      |
| `description`       | text null   |                                                   |
| `enabled`           | bool        | default `true`; `false` hides all versions publicly |
| `current_version_id`| uuid null   | FK → version.id (the version served at `/<slug>/`)|
| `created_at`        | bigint      | epoch seconds                                     |
| `updated_at`        | bigint      |                                                   |

**version**

| column        | type       | notes                                             |
|---------------|------------|---------------------------------------------------|
| `id`          | uuid (pk)  |                                                   |
| `project_id`  | uuid (fk)  | → project.id, `ON DELETE CASCADE`                 |
| `number`      | int        | per-project sequential; unique `(project_id, number)` |
| `name`        | varchar null | the version's label/description from upload     |
| `enabled`     | bool       | default `true`; `false` hides this version publicly |
| `size_bytes`  | bigint     | size of the uploaded zip                          |
| `file_count`  | int        | number of files extracted                         |
| `created_at`  | bigint     |                                                   |
| `updated_at`  | bigint     |                                                   |

- `project.current_version_id` is a nullable FK so a project can exist with no published version,
  and "current" can point at any version (not necessarily the latest).
- Deleting a version that is current → current is repointed to the latest remaining **enabled**
  version, or `null` if none.
- Files live on disk at `DEMOS_ROOT/<slug>/<number>/…`; the DB is the index/metadata.

---

## 5. Backend modules (SOLID)

NestJS on **platform-express** (needed for multipart + the static catch-all). Each module has a
single responsibility and depends on abstractions, not concretions.

```
src/
  main.ts                     bootstrap; wires the static/demo catch-all onto Express last
  app.module.ts               composition root
  config/                     typed env loading + Joi validation
  database/                   DataSource (CLI + app), migrations
  common/                     ResponseInterceptor, AllExceptionsFilter, AppError types, slug util
  entities/                   Project, Version (shared TypeORM entities)
  projects/                   ProjectsController + ProjectsService (CRUD, enable/disable, delete)
  versions/                   VersionsController + VersionsService (upload, promote, enable, delete)
  storage/                    StorageService (fs layout) + IArchiveExtractor / SystemUnzipExtractor
  demos/                      DemoResolverService + DemoServingHandler + html base-injection
  manager/                    ManagerStaticHandler (serve client/dist with SPA fallback)
  health/                     HealthController
```

**Key seams (dependency inversion):**

- `IArchiveExtractor` — interface for unzip. Default `SystemUnzipExtractor` shells out to the
  system `unzip` (present on the host; no npm zip dependency, honoring "prefer native/system"). It
  pre-reads the archive listing (`unzip -l`) to enforce **entry-count** and **uncompressed-size**
  limits (zip-bomb guard) and to reject entries with absolute paths or `..` (traversal guard) before
  extracting. Swappable for a pure-JS impl without touching callers.
- `StorageService` — owns the on-disk layout: it alone knows paths are `DEMOS_ROOT/<slug>/<n>`.
  Responsible for: allocate version dir, extract via `IArchiveExtractor`, **flatten** a single
  wrapping top-level folder, **ensure an `index.html`** at the version root (falling back to a single
  root-level `.html`/`.htm` file, renamed to `index.html`; reject if there are none or more than one),
  compute size/file-count, and `rm -rf` on delete. Nothing else touches the filesystem.
- `DemoResolverService` — pure decision logic: `(slug, restPath) → { project, version, filePath,
  baseHref } | NotFound`. No I/O beyond DB reads; trivially testable.
- Controllers are thin: validate DTOs, call services, return data. The `ResponseInterceptor` shapes
  the envelope; the `AllExceptionsFilter` shapes errors. Controllers never format responses or
  touch the filesystem directly.

**Upload flow (`POST /api/v1/projects/:slug/versions`):**

1. Multer streams the multipart file to a temp path on disk (size-limited by `MAX_UPLOAD_MB`).
2. `VersionsService` computes the next `number`, asks `StorageService` to extract into the version
   dir (which runs the safety checks + flatten + index detection).
3. On success: insert the `version` row (size, file_count); if `promote` (default true) set the
   project's `current_version_id`.
4. Always clean up the temp file. Any failure (bad zip, no index, over-limit, traversal) →
   structured 4xx, the partially-created dir is removed, nothing is committed to the DB.

---

## 6. API surface

JSON, under `/api/v1`. Standard envelopes:

```jsonc
// success
{ "success": true, "data": <payload> }
// error
{ "success": false, "error": { "code": "VALIDATION", "message": "…", "details": { … } } }
```

| Method & path                                   | Purpose                                          |
|-------------------------------------------------|--------------------------------------------------|
| `GET  /api/v1/projects`                         | List projects (with version summaries + current) |
| `POST /api/v1/projects`                         | Create `{ name, slug?, description? }`            |
| `GET  /api/v1/projects/:slug`                   | Project detail + full version list                |
| `PATCH /api/v1/projects/:slug`                  | Update `{ name?, description?, enabled? }`        |
| `DELETE /api/v1/projects/:slug`                 | Delete project + all versions + files             |
| `POST /api/v1/projects/:slug/versions`          | Upload zip → new version (`multipart`: `file`, `name?`, `promote?`) |
| `PATCH /api/v1/projects/:slug/versions/:number` | Update `{ name?, enabled? }`                      |
| `POST /api/v1/projects/:slug/versions/:number/promote` | Make this version current                  |
| `DELETE /api/v1/projects/:slug/versions/:number`| Delete a version + its files                      |
| `GET  /healthz`                                 | Health (db connectivity)                          |

Error `code`s: `VALIDATION`, `NOT_FOUND`, `CONFLICT` (e.g. duplicate slug), `PAYLOAD_TOO_LARGE`,
`BAD_ARCHIVE`, `NO_INDEX_HTML`, `INTERNAL`. The client maps these to friendly messages/toasts.

---

## 7. CLI (designed-in now, thin wrapper shipped)

Every admin operation is a plain REST call, so a CLI is just an HTTP client. Shipped now:
`scripts/demo` — a small POSIX shell CLI (curl + jq) that is the worked example for the future
`ven demo …` integration:

```bash
demo projects                                   # list
demo create "Acme Redesign" --slug acme         # create a project
demo publish acme ./build.zip \                 # upload a new version from a local zip
     --name "Q2 homepage" --promote             # promote defaults on; --no-promote to skip
demo promote acme 3                             # set version 3 current
demo disable acme 2 | demo enable acme 2        # toggle a version
demo rm acme 2                                  # delete a version
demo rm acme                                    # delete the project
```

Config via env: `DEMO_API` (default `https://demos.ryanweiss.net`), optional `DEMO_TOKEN` (forward
compatible with §9 auth). Output is the API's JSON (pipeable to `jq`); `--quiet` for scripts. The
`publish` verb mirrors the UI's upload modal: it can print the computed next version and zip size
before sending with `--dry-run`.

---

## 8. Frontend (Preact admin client)

Stack mirrors the workspace's `release-manager/app`: **Preact 10 + preact-router + Vite + SCSS
modules + a CSS-custom-property design-token system**, built with `base: '/manage/'`.

**Design language** — "deep-space, sharp, tech-casual." We adapt the existing token system
(`styles/_variables.scss`) but give demo-manager its own accent identity (an electric
**lime/spring-green** primary against the cool dark surfaces, violet secondary) so it reads as its
own product while staying in the family. Fonts: **Space Grotesk** (display), **Inter Tight** (UI),
**JetBrains Mono** (slugs, sizes, versions). Everything tokenized (color, space on a 4pt grid,
radii, shadows, motion easings, z-layers). Fully responsive: dashboard columns flow into a single
stacked column on mobile.

**Screens**

- **Dashboard** (`/manage`) — a horizontally scrolling row of **project columns**. Each column
  header shows the name, slug (mono), enabled state, and a "+ version" affordance; below it, the
  versions list newest-first, the current one badged. "New project" opens a modal. A project that's
  disabled is visually dimmed.
- **Project detail** (`/manage/p/:slug`) — header with name/slug/description, project-level actions
  (open public site, disable/enable, delete). A drag-drop **upload dropzone** at the top. Below, a
  column of **version blocks**: each shows number, label, size, file count, created date, current
  badge, enabled state, and a "current" radio; selecting a block reveals actions (promote, enable/
  disable, delete). Links to view the version publicly (`/<slug>/<n>/`).

**Upload modal** — opens when a zip is dropped/selected. Shows filename, human size, the **computed
next version number** (from the project's existing versions), a name/description field, and a
**"Promote to current" toggle (default on)**. Confirm uploads with progress; errors render inline.

**Error handling** — three layers: a top-level `ErrorBoundary` (render crashes), a **toast** system
fed by the API client for request failures (mapping the error envelope's `code`/`message`), and
inline field errors on forms/uploads. Network/permission/validation errors all reach the user with
a clear message rather than a silent failure.

**Data layer** — a tiny typed `api.ts` fetch wrapper that unwraps the success envelope and throws a
typed `ApiError` on the error envelope; thin hooks (`useProjects`, `useProject`, `useUpload`) hold
view state. No heavy state library — this is a small dashboard.

---

## 9. Auth seam (future, not built)

Designed so we can gate later with minimal churn:

- The app already isolates **public serving** (`/<slug>`, `/manage` assets) from the **admin API**
  (`/api/v1`) and **manager app shell**. A future `AuthGuard` wraps `/api/v1/**` and the `/manage`
  shell; public demo serving can be gated **per project** via a `project.visibility`
  (`public | private`) column + a check in `DemoResolverService`, or globally via a single env flag
  / front gate.
- The platform standard is HS256 JWTs from `@rw3iss/auth-server` with **local** per-request
  verification (see `auth/auth-server-nest`). The guard would validate the bearer token the same
  way `release-manager/server` does. The CLI already threads an optional `DEMO_TOKEN`.
- Nothing in the current routing or data model blocks this; it's purely additive.

---

## 10. Deployment

Mirrors the **auth-server** precedent exactly: a native **systemd** service behind the containerized
nginx, using the box's existing Postgres. No Docker for our app.

- **Runtime:** Node 22 installed on the host at a fixed path (`/opt/node`), referenced absolutely by
  the unit. App runs `node dist/main.js`, binds `0.0.0.0:8092`.
- **systemd:** `deploy/systemd/demo-manager.service` — `Restart=always`, `StartLimitIntervalSec=0`,
  `EnvironmentFile=…/server/.env`, hardened (`ProtectSystem=strict`, `NoNewPrivileges`,
  `PrivateTmp`). `ReadWritePaths` includes both the app dir **and** `DEMOS_ROOT` (`/opt/demos`),
  because the service writes uploaded demos there under `ProtectSystem=strict`.
- **nginx:** `deploy/nginx/demos.ryanweiss.net.conf` → copy into `/opt/rw-cms/nginx/conf.d/`. HTTP
  block serves the ACME challenge and redirects to HTTPS; HTTPS block `proxy_pass`es to
  `http://172.20.0.1:8092` (the docker bridge gateway = the host as seen from the nginx container).
  `client_max_body_size 300M` and generous `proxy_*_timeout` so large zip uploads pass through.
- **TLS:** host `certbot` webroot issuance (webroot volume
  `/var/lib/docker/volumes/rw-certbot-webroot/_data`), self-signed bootstrap so nginx starts first,
  then the real cert copied to `/opt/rw-cms/nginx/ssl/demos-{fullchain,privkey}.pem`, plus a
  `/etc/letsencrypt/renewal-hooks/deploy/demos.ryanweiss.net.sh` hook that re-copies on renewal and
  reloads nginx. DNS for `demos.ryanweiss.net` already points at the box.
- **Database:** create `demo_manager` on `rw-postgres` (owner `twenty`). The app connects to
  `127.0.0.1:5432`. **Migrations auto-run on boot** in production (`DB_RUN_MIGRATIONS=true`), so a
  deploy is just "ship + restart."
- **Demos root:** `sudo mkdir -p /opt/demos && sudo chown ec2-user:ec2-user /opt/demos`.

**Bootstrap** is a single idempotent script — `scripts/setup-server.sh` — run once on the host:
installs Node, creates `/opt/demos`, creates the DB, writes `server/.env` (pulling the Postgres
password from the running container so no secret lands in the repo), installs + enables the systemd
unit, drops the nginx vhost, and runs the SSL issuance. **Deploys** thereafter are
`scripts/deploy.sh` (build locally → rsync artifacts → `npm ci --omit=dev` → restart → health-check)
or the GitHub Actions workflow that runs the same steps on push.

### 10.1 CI/CD

`.github/workflows/deploy.yml` — on push to `main` (and manual `workflow_dispatch`): setup Node 22,
build server + client, rsync the artifact bundle to `~/apps/demo-manager/` over SSH (deploy key in
the `SSH_PRIVATE_KEY` secret), `npm ci --omit=dev` for the server on the host, `sudo systemctl
restart demo-manager`, then gate on `curl localhost:8092/healthz`. Identical in spirit to the
auth-server pipeline already running for the org.

---

## 11. Repository layout

```
demo-manager/
├── README.md            ← concise "how it works / how to run" (REQUIRED, see note)
├── CLAUDE.md            ← agent guide incl. how to connect to the prod server
├── docs/ARCHITECTURE.md ← this file
├── server/             ← NestJS API + static/demo serving
├── client/             ← Preact admin SPA (built, served at /manage)
├── deploy/             ← systemd unit + nginx vhost
├── scripts/            ← setup-server.sh, deploy.sh, demo (CLI)
└── .github/workflows/  ← deploy.yml
```

> **README requirement:** ship a concise, easy-to-understand `README.md` covering what the system
> is, the URL model (`/<slug>/`, `/<slug>/<n>/`, `/manage`), how to run both halves locally, how to
> publish a demo (UI and CLI), and how to deploy. Keep it short and scannable.

---

## 12. Key decisions & trade-offs (summary)

| Decision | Choice | Why |
|---|---|---|
| Backend framework | NestJS (platform-express) | Matches workspace convention; DI gives clean SOLID seams; Express enables the static catch-all + multipart. |
| One process vs two | **One** (API + manager UI + demo serving) | One nginx vhost, one systemd unit; "add a project = zero infra change." |
| Static serving | **By the app**, not nginx | App knows enabled/current/version from the DB; keeps nginx a dumb single proxy. |
| Unzip | **System `unzip`** behind an interface | No npm zip dep ("prefer native/system"); swappable; safety checks from the listing. |
| DB | Postgres (`demo_manager` on `rw-postgres`) | Reuse the running service; platform standard. |
| Version ref | per-project integer `number` | Matches the requested `/<slug>/<n>/` URL scheme. |
| SPA support | `<base href>` injection + index fallback | Makes relative-path bundles work under any subpath. |
| Migrations | auto-run on boot in prod | "Ship + restart" deploys; fine at this scale. |
| Auth | none now, **seam designed** | User wants public now, gating later, with minimal churn. |
| Process mgmt | native **systemd** (no Docker for app) | Mirrors auth-server; user requirement. |

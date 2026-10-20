# demo-manager — agent guide

Static-demo publishing system: a Preact admin client + a NestJS server that
**also** serves the demos. Single process, single nginx vhost.

> Read `docs/ARCHITECTURE.md` for the *why*; `README.md` for the quick start.

## Shape

```
server/   NestJS — /api/v1 (admin), /manage (admin SPA), /<slug>/.. (demos)
client/   Preact 10 + Vite admin SPA, built to client/dist, served at /manage
deploy/   systemd unit + nginx vhost
scripts/  deploy.sh (local) · setup-server.sh (host, idempotent) · demo (CLI)
```

- **Server** runs on Express (platform-express) so it can do multipart upload +
  a static catch-all. Routing: Nest controllers own `/api/v1` + `/healthz`; a
  catch-all Express middleware (registered first, `next()`s those two through)
  serves `/manage`, the demos, and the `/` → `/manage` redirect. Order matters —
  see `server/src/main.ts`.
- **DB:** Postgres, TypeORM, two entities (`project`, `version`). Migrations live
  in `server/src/database/migrations` and **auto-run on boot** in prod
  (`DB_RUN_MIGRATIONS=true`).
- **Storage:** demos unzip to `DEMOS_ROOT/<slug>/<n>/` (`/opt/demos` in prod).
  `StorageService` is the only thing that touches that filesystem; unzip goes
  through the swappable `ArchiveExtractor` (default: system `unzip`).
- **Conventions:** timestamps are Unix epoch seconds; path alias `@/*`→`src/*`
  (server) / `@`,`@styles` (client); errors flow through `AppError` →
  `AllExceptionsFilter` as `{ success:false, error:{ code,message } }`.

## Local dev / build / test

```bash
# server (:8092)
cd server && cp .env.example .env && npm install && npm run dev
# client (:5173, proxies /api → :8092)
cd client && npm install && npm run dev
npm run typecheck        # in either package
```

No DB handy? A throwaway Postgres works: `initdb -D /tmp/pg -U postgres
--auth-host=trust && pg_ctl -D /tmp/pg -o "-p 5433" start && createdb -p 5433
-U postgres demo_manager`, then point `server/.env` at `127.0.0.1:5433` with
`DB_RUN_MIGRATIONS=true`.

## Production — ven-internal

**Connect:**

```bash
ssh -i ~/Sites/ven/_keys/dev-admins.pem ec2-user@3.12.0.133
```

This box (Amazon Linux 2023) runs everything else in Docker (`/opt/ven-cms/`),
but demo-manager is a **native systemd service** like the Go auth-server — it is
NOT in Docker. It reuses the box's `ven-postgres` and `ven-nginx` containers.

| Thing | Where |
|---|---|
| App dir | `/home/ec2-user/apps/demo-manager/` (`server/`, `client/dist`) |
| Node runtime | `/opt/node/bin/node` (installed by `setup-server.sh`) |
| Service | `demo-manager.service` (`/etc/systemd/system/`) → host `:8092` |
| Env (secrets) | `~/apps/demo-manager/server/.env` (chmod 600) |
| Demos on disk | `/opt/demos/<slug>/<n>/` |
| Database | `demo_manager` on `ven-postgres` (user `twenty`, host `127.0.0.1:5432`) |
| nginx vhost | `/opt/ven-cms/nginx/conf.d/demos.ryanweiss.net.conf` → `proxy_pass 172.20.0.1:8092` |
| TLS | `/opt/ven-cms/nginx/ssl/demos-{fullchain,privkey}.pem` (certbot; renewal hook copies + reloads) |

**Operate:**

```bash
sudo systemctl status demo-manager
sudo journalctl -u demo-manager -f          # live logs
sudo systemctl restart demo-manager
curl -s http://localhost:8092/healthz       # local health
# DB shell (psql isn't on the host — go through the container):
sudo docker exec -it ven-postgres psql -U twenty -d demo_manager
# nginx (containerized):
sudo docker exec ven-nginx nginx -t && sudo docker exec ven-nginx nginx -s reload
```

## Deploying

From a local clone (builds, ships, bootstraps idempotently, restarts, health-gates):

```bash
bash scripts/deploy.sh
```

Or push to `main` → `.github/workflows/deploy.yml` does the same (needs the
`SSH_PRIVATE_KEY` repo secret = contents of `dev-admins.pem`).

**First time on a fresh box:** `deploy.sh` calls `setup-server.sh` automatically;
it installs Node, creates `/opt/demos`, creates the DB, writes `server/.env`
(pulling the PG password from the running `ven-postgres` container — no secret in
the repo), installs the systemd unit + nginx vhost, and issues the TLS cert
(self-signed bootstrap → certbot webroot). DNS for `demos.ryanweiss.net` already
points at the box.

## Gotchas

- The static catch-all must stay **first** in the Express stack (it `next()`s
  `/api` + `/healthz`). If you `app.init()` before attaching it, Nest's
  not-found handler shadows it — don't.
- nginx is in a container; the proxy target is the docker bridge gateway
  **`172.20.0.1`** (the host as seen from `ven-nginx`), not `127.0.0.1`.
- `client_max_body_size` in the vhost must be ≥ the app's `MAX_UPLOAD_MB`.
- Uploaded demos must use **relative** asset paths and have `index.html` at the
  root (or one folder deep). Absolute `/assets/...` demos won't resolve under the
  subpath.
- Don't hand-edit `dist/`; it's rebuilt from `src/`.

# demo-manager — agent guide

Static-demo publishing system: a Preact admin client + a NestJS server that
**also** serves the demos. Single process, single nginx vhost.

> Read `docs/ARCHITECTURE.md` for the *why*; `README.md` for the quick start.

## Shape

```
server/   NestJS — /api/v1 (admin), /manage (admin SPA), /<slug>/.. (demos)
client/   Preact 10 + Vite admin SPA, built to client/dist, served at /manage
deploy/   systemd unit + nginx vhost
scripts/  deploy.sh (local) · update.sh + setup-server.sh (on host) · demo (CLI)
```

- **Server** runs on Express (platform-express) so it can do multipart upload +
  a static catch-all. Routing: Nest controllers own `/api/v1` + `/healthz`; a
  catch-all Express middleware (registered first, `next()`s those two through)
  serves `/manage`, the demos, and the `/` → `/manage` redirect. Order matters —
  see `server/src/main.ts`.
- **DB:** Postgres, TypeORM, two entities (`project`, `version`). Migrations live
  in `server/src/database/migrations` and **auto-run on boot** in prod
  (`DB_RUN_MIGRATIONS=true`).
- **Storage:** demos unzip to `DEMOS_ROOT/<slug>/<n>/` (`/var/lib/demo-manager/demos` in prod).
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

## Production — ryanweiss.net

Live at **https://demos.ryanweiss.net** (manager: `/manage`). Host: the
ryanweiss.net box, InterServer **Fedora 44**, IP `162.35.181.92`. SSH as
`rw3iss@162.35.181.92` (shell alias `rw`; NOPASSWD sudo). Native services — no
Docker. The box's own handbook is `~/README.md` on the server.

| Thing | Where |
|---|---|
| App (git checkout, built on the box) | `/var/www/demo-manager` (`server/dist`, `client/dist`), branch `main`, public HTTPS remote |
| Node runtime | `/usr/local/bin/node` (v22, box-wide) |
| Service | `demo-manager.service` (`/etc/systemd/system/`), User `rw3iss` → **`127.0.0.1:4090`** |
| Self-healing | `Restart=always` + `StartLimitIntervalSec=0`; `demo-manager-healthcheck.timer` (every 2 min) restarts it if `/healthz` stops answering |
| Env (secrets) | `/etc/demo-manager/demo-manager.env` (root, 0600) — generated once by `setup-server.sh` |
| Demos on disk | `/var/lib/demo-manager/demos/<slug>/<n>/` |
| Database | Postgres 18 (native), role + db **`demo_manager`**, `127.0.0.1:5432` |
| nginx vhost | `/etc/nginx/conf.d/demos.ryanweiss.net.conf` → `proxy_pass 127.0.0.1:4090` |
| TLS | Let's Encrypt `/etc/letsencrypt/live/demos.ryanweiss.net/` (webroot `/var/www/letsencrypt`, auto-renew via `certbot-renew.timer`) |

Port note: `8092` is taken on this box (Beszel), hence `4090`.

**Operate (on the server):**

```bash
sudo systemctl status demo-manager
sudo journalctl -u demo-manager -f                  # live logs
sudo systemctl restart demo-manager
curl -s http://127.0.0.1:4090/healthz               # local health
systemctl list-timers demo-manager-healthcheck.timer
sudo -u postgres psql demo_manager                   # DB shell
sudo nginx -t && sudo systemctl reload nginx
```

## Deploying

The server pulls `origin/main` and builds itself. Push first, then:

```bash
bash scripts/deploy.sh          # local: SSH → runs scripts/update.sh on the box
# or, on the server:
bash /var/www/demo-manager/scripts/update.sh
```

`update.sh`: `git reset --hard origin/main` → `npm ci && npm run build` (server
+ client) → `setup-server.sh` (idempotent host config) → restart → health-gate on
`/healthz`. Migrations auto-run on boot (`DB_RUN_MIGRATIONS=true`).

`.github/workflows/deploy.yml` runs the same over SSH on push to `main`, but only
if the `SSH_PRIVATE_KEY` repo secret (a key authorized for `rw3iss@162.35.181.92`)
is set; otherwise it skips.

**First time / fresh box:** `git clone https://github.com/rw3iss/demo-manager.git
/var/www/demo-manager && bash /var/www/demo-manager/scripts/update.sh`.
`setup-server.sh` creates the data dir, the Postgres role/db (random password),
the env file, installs + enables the systemd units, issues the TLS cert (HTTP-01
webroot), and installs the nginx vhost. DNS for `demos.ryanweiss.net` points at
the box (Cloudflare-proxied).

## Gotchas

- The static catch-all must stay **first** in the Express stack (it `next()`s
  `/api` + `/healthz`). If you `app.init()` before attaching it, Nest's
  not-found handler shadows it — don't.
- The env lives in `/etc/demo-manager/demo-manager.env`, not `server/.env`.
  `setup-server.sh` never overwrites it once it exists — edit it in place, then
  restart.
- The unit runs with `ProtectSystem=strict`; the only writable path is
  `/var/lib/demo-manager`. Moving `DEMOS_ROOT` means updating `ReadWritePaths`.
- `client_max_body_size` in the vhost must be ≥ the app's `MAX_UPLOAD_MB`.
- Uploaded demos must use **relative** asset paths and have `index.html` at the
  root (or one folder deep). Absolute `/assets/...` demos won't resolve under the
  subpath.
- Don't hand-edit `dist/`; it's rebuilt from `src/`.

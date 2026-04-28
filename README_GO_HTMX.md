# NetPlug (Go + HTMX)

This repo currently contains the original Next.js implementation **and** a new Go+HTMX server (work-in-progress) under `cmd/netplug`.

## Run

### Requirements
- Go 1.23+
- SQLite (via CGO driver `github.com/mattn/go-sqlite3`)
- Optional: `wg` / `wg-quick` in `$PATH` (for background sync)

### Start the server

```bash
go run ./cmd/netplug
```

Defaults:
- HTTP: `:8080`
- Data dir: `./sandbox/data`
- SQLite: `./sandbox/data/netplug.sqlite`

Environment:
- `HTTP_ADDR`: e.g. `:8080`
- `DATA_DIR`: e.g. `./sandbox/data`
- `SQLITE_PATH`: e.g. `./sandbox/data/netplug.sqlite`
- `WG_INTERFACE`: default `wg0`
- `WIREGUARD_SYNC_INTERVAL_SEC`: default `30`
- `COOKIE_SECURE`: `true` in HTTPS deployments
- `BOOTSTRAP_ADMIN_USERNAME`: create first admin if DB empty
- `BOOTSTRAP_ADMIN_PASSWORD`: password for bootstrap admin

## Create an admin user (bootstrap)

If the `users` table is empty, you can set:

```bash
export BOOTSTRAP_ADMIN_USERNAME=admin
export BOOTSTRAP_ADMIN_PASSWORD='admin1234'
```

Then start the server. Login at `http://localhost:8080/login`.

## What’s implemented
- Basic auth (username/password) with secure cookie sessions
- Dashboard + HTMX partials for stats and active connections
- Background WireGuard poller:
  - `wg show <iface> dump` every `WIREGUARD_SYNC_INTERVAL_SEC`
  - updates `vpn_users` connection + transfer stats
  - writes bandwidth snapshots (24h retention)

## Next parity steps
- Setup wizard + config editing
- User/server CRUD screens (HTMX forms)
- WireGuard config generation + live reload (`wg syncconf`)


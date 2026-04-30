## NetPlug (Go + HTMX)

NetPlug is a **Go + HTMX** web UI backed by **SQLite**, with a background sync loop for **WireGuard** state.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Setup flow**: first-run wizard at `/setup`
- **Auth**: cookie-backed sessions
- **WireGuard management**: view/save config, reload/apply, live stats sync
- **User management**: create/edit/disable users, generate keys, download configs (and QR where available)
- **Dashboard**: overview + bandwidth history API for charts

## Quickstart (local)

### Prerequisites

- Go **1.24+** (see `go.mod`)
- A C toolchain (required by `github.com/mattn/go-sqlite3`)
  - macOS: Xcode Command Line Tools
  - Linux: `build-base`/`gcc` toolchain

### Run

```bash
go run ./cmd/netplug
```

Then open:

- `http://localhost:8080/setup` (first run)
- `http://localhost:8080/ui` (after setup/login)

### Build

```bash
make build
./bin/netplug
```

### Test

```bash
make test
```

## Docker / Compose

`docker-compose.yml` builds a small runtime image that includes `wireguard-tools` and runs NetPlug with the required capabilities/sysctls for WireGuard.

### Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose`)
- **Linux host recommended** for full WireGuard functionality
  - The compose config mounts `/lib/modules` and requests `NET_ADMIN`/`SYS_MODULE`. That only works on a Linux host with kernel module support.
  - On macOS/Windows (Docker Desktop), you can still run the UI and persist the SQLite DB, but WireGuard apply/stats may not work because the container is running inside a Linux VM.

### Configure

Compose will read a local `.env` file if present (optional). The most common knobs are:

- `DASHBOARD_PORT` (default `127.0.0.1:8080`): where the web UI is published
- `WG_PORT` (default `51820`): the published WireGuard UDP port
- `DATA_PATH` (default `./data`): host directory for persistent state (mounted to `/data`)
- `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD`: create an initial admin user on first boot when the DB is empty

### `docker-compose.yml` example

This repo already includes `docker-compose.yml`. If you want a minimal, copy/paste example (for another machine/repo), this is the shape:

```yaml
services:
  netplug:
    image: ghcr.io/plugvpn/netplug:latest
    container_name: netplug-wireguard
    restart: unless-stopped
    init: true
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.ip_forward=1
      - net.ipv4.conf.all.src_valid_mark=1
      - net.ipv6.conf.all.disable_ipv6=0
      - net.ipv6.conf.all.forwarding=1
      - net.ipv6.conf.default.forwarding=1
    ports:
      - "51820:51820/udp"
      - "127.0.0.1:8080:8080"
    environment:
      DATA_DIR: /data
      SQLITE_PATH: /data/netplug.sqlite
      HTTP_ADDR: :8080
      WG_INTERFACE: wg0
      WIREGUARD_SYNC_INTERVAL_SEC: "30"
      COOKIE_SECURE: "false"
    volumes:
      - ./data:/data
      - /lib/modules:/lib/modules:ro
```

Pull the image (optional; `docker compose up` will pull automatically if needed):

```bash
docker pull ghcr.io/plugvpn/netplug:latest
```

Example `.env`:

```bash
# Web UI (bind to loopback by default)
DASHBOARD_PORT=127.0.0.1:8080

# WireGuard UDP port
WG_PORT=51820

# Persist DB/config/state on the host
DATA_PATH=./data

# Optional: create an initial admin user on first boot
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=change-me

# Optional: set true when served over HTTPS
COOKIE_SECURE=false
```

### Run

Build and start:

```bash
docker compose up --build
```

Or run detached:

```bash
docker compose up -d --build
```

Then open:

- `http://localhost:8080/setup` (first run)
- `http://localhost:8080/ui` (after setup/login)

Defaults (override via `.env` or environment variables):

- UI: `http://localhost:8080` (bound to `127.0.0.1` by default in compose)
- WireGuard UDP port: `51820/udp`
- Persistent data: `./data` on the host, mounted to `/data` in the container

### Operate

```bash
# follow logs
docker compose logs -f netplug

# restart after config changes
docker compose restart netplug

# stop and remove containers (keeps ./data)
docker compose down
```

### Troubleshooting notes

- If WireGuard apply/stats fail, verify the host supports WireGuard and that the kernel module is available (the compose config mounts `/lib/modules` read-only).
- If you’re running Podman and see raw socket errors, `docker-compose.yml` includes a commented `NET_RAW` capability you can enable.
- If you publish the UI beyond loopback (set `DASHBOARD_PORT=0.0.0.0:8080`), strongly consider `COOKIE_SECURE=true` behind HTTPS and protect access appropriately.

## Configuration

NetPlug is configured entirely via environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `HTTP_ADDR` | `:8080` | HTTP listen address |
| `DATA_DIR` | `./sandbox/data` | Data directory for runtime files |
| `SQLITE_PATH` | `${DATA_DIR}/netplug.sqlite` | SQLite DB file path |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS (sets `Secure` cookies) |
| `WG_INTERFACE` | `wg0` | WireGuard interface name |
| `WIREGUARD_SYNC_INTERVAL_SEC` | `30` | Background sync interval (seconds) |
| `BOOTSTRAP_ADMIN_USERNAME` | *(empty)* | Create initial admin user when DB has no users |
| `BOOTSTRAP_ADMIN_PASSWORD` | *(empty)* | Password for the bootstrapped admin |

### Data paths (defaults)

- **SQLite DB**: `./sandbox/data/netplug.sqlite`
- **WireGuard config**: typically written under `DATA_DIR` (for example `./sandbox/data/wg0.conf`)

### WireGuard tooling

- The UI can run without WireGuard tooling installed.
- To apply/reload configs and pull live interface stats, the host/container needs WireGuard support and tools (for example `wg`, `wg-quick`).

## HTTP endpoints

- `GET /healthz`: health check (`ok`)
- `GET/POST /login`: login
- `GET /setup` + POST actions under `/setup/*`: first-run setup
- `GET /ui`: main UI (requires auth)

## Project structure

```
.
├── cmd/netplug/                # main entrypoint
├── internal/
│   ├── app/                    # HTTP handlers, routing, services, config
│   ├── assets/                 # embedded static assets served at /assets/*
│   ├── db/                     # SQLite migrations + bootstrap logic
│   ├── view/                   # HTML templates (HTMX)
│   ├── version/                # build/revision metadata
│   └── wireguard/              # WireGuard config/state/sync/apply logic
├── web/static/                 # non-embedded static files served at /static/*
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── go.mod
```

## License

MIT. See [LICENSE](LICENSE).

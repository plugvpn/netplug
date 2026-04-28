package db

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"strings"
)

const schemaSQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY,
  is_setup_complete INTEGER NOT NULL DEFAULT 0,
  vpn_configuration TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS smtp_config (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  encryption TEXT NOT NULL DEFAULT 'TLS',
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NULL,
  email TEXT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  otp_enabled INTEGER NOT NULL DEFAULT 0,
  otp_secret TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS vpn_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NULL,
  config_path TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  private_key TEXT NULL,
  public_key TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vpn_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  common_name TEXT NULL,
  allowed_ips TEXT NULL,
  endpoint TEXT NULL,
  last_handshake TEXT NULL,
  private_key TEXT NULL,
  public_key TEXT NULL,
  preshared_key TEXT NULL,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  bytes_sent INTEGER NOT NULL DEFAULT 0,
  prev_bytes_received INTEGER NOT NULL DEFAULT 0,
  prev_bytes_sent INTEGER NOT NULL DEFAULT 0,
  bytes_received_rate INTEGER NOT NULL DEFAULT 0,
  bytes_sent_rate INTEGER NOT NULL DEFAULT 0,
  total_bytes_received INTEGER NOT NULL DEFAULT 0,
  total_bytes_sent INTEGER NOT NULL DEFAULT 0,
  remaining_days INTEGER NULL,
  remaining_traffic_bytes INTEGER NULL,
  last_day_check TEXT NULL,
  connected_at TEXT NULL,
  is_connected INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  server_id TEXT NOT NULL,
  peer_icon TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(server_id) REFERENCES vpn_servers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vpn_users_server_id ON vpn_users(server_id);
CREATE INDEX IF NOT EXISTS idx_vpn_users_is_connected ON vpn_users(is_connected);
CREATE INDEX IF NOT EXISTS idx_vpn_users_public_key ON vpn_users(public_key);

CREATE TABLE IF NOT EXISTS bandwidth_snapshots (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  download_rate INTEGER NOT NULL,
  upload_rate INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bandwidth_snapshots_timestamp ON bandwidth_snapshots(timestamp);
`

func Migrate(db *sql.DB) error {
	if db == nil {
		return errors.New("db is nil")
	}
	sum := sha256.Sum256([]byte(schemaSQL))
	id := hex.EncodeToString(sum[:])

	var exists string
	err := db.QueryRow(`SELECT id FROM schema_migrations WHERE id = ? LIMIT 1`, id).Scan(&exists)
	if err == nil {
		return nil
	}
	// First run: schema_migrations might not exist yet.
	if err != nil && strings.Contains(err.Error(), "no such table: schema_migrations") {
		err = sql.ErrNoRows
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(schemaSQL); err != nil {
		return err
	}
	if _, err := tx.Exec(`INSERT INTO schema_migrations (id) VALUES (?)`, id); err != nil {
		return err
	}
	return tx.Commit()
}


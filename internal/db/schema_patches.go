package db

import (
	"database/sql"
	"strings"
)

// ApplySchemaPatches runs idempotent DDL for installs that already applied an older baseline schema.
func ApplySchemaPatches(db *sql.DB) error {
	if db == nil {
		return nil
	}
	const patch = `
CREATE TABLE IF NOT EXISTS vpn_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vpn_group_members (
  group_id TEXT NOT NULL,
  vpn_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, vpn_user_id),
  FOREIGN KEY(group_id) REFERENCES vpn_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(vpn_user_id) REFERENCES vpn_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vpn_group_members_user ON vpn_group_members(vpn_user_id);

DROP INDEX IF EXISTS idx_vpn_group_firewall_rules_group;
DROP TABLE IF EXISTS vpn_group_firewall_rules;

CREATE TABLE IF NOT EXISTS vpn_group_pcq (
  group_id TEXT PRIMARY KEY,
  download_limit_kbps INTEGER NULL,
  upload_limit_kbps INTEGER NULL,
  burst_download_kbps INTEGER NULL,
  burst_upload_kbps INTEGER NULL,
  pcq_classifier TEXT NOT NULL DEFAULT 'dual',
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(group_id) REFERENCES vpn_groups(id) ON DELETE CASCADE
);
`
	if _, err := db.Exec(patch); err != nil {
		return err
	}
	// Idempotent column addition for existing installs (ignore error if column already exists).
	_, _ = db.Exec(`ALTER TABLE vpn_group_pcq ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0`)

	_, _ = db.Exec(`ALTER TABLE vpn_servers ADD COLUMN wg_interface TEXT NULL`)
	_, _ = db.Exec(`ALTER TABLE vpn_servers ADD COLUMN wg_server_address TEXT NULL`)
	_, _ = db.Exec(`ALTER TABLE vpn_servers ADD COLUMN wg_client_range TEXT NULL`)

	if err := migrateVPNUsersCompositeUnique(db); err != nil {
		return err
	}
	return nil
}

// migrateVPNUsersCompositeUnique replaces a global UNIQUE(username) with UNIQUE(server_id, username)
// so the same display name can exist on different WireGuard instances.
func migrateVPNUsersCompositeUnique(db *sql.DB) error {
	var createSQL string
	err := db.QueryRow(`SELECT sql FROM sqlite_master WHERE type='table' AND name='vpn_users'`).Scan(&createSQL)
	if err != nil {
		return err
	}
	if strings.Contains(createSQL, "UNIQUE (server_id, username)") {
		return nil
	}
	if !strings.Contains(createSQL, "username TEXT NOT NULL UNIQUE") {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	_, _ = tx.Exec(`PRAGMA foreign_keys = OFF`)
	_, err = tx.Exec(`
CREATE TABLE vpn_users__np (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
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
  UNIQUE(server_id, username),
  FOREIGN KEY(server_id) REFERENCES vpn_servers(id) ON DELETE CASCADE
)`)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
INSERT INTO vpn_users__np (
  id, username, common_name, allowed_ips, endpoint, last_handshake, private_key, public_key, preshared_key,
  bytes_received, bytes_sent, prev_bytes_received, prev_bytes_sent, bytes_received_rate, bytes_sent_rate,
  total_bytes_received, total_bytes_sent, remaining_days, remaining_traffic_bytes, last_day_check, connected_at,
  is_connected, is_enabled, server_id, peer_icon, created_at, updated_at
)
SELECT
  id, username, common_name, allowed_ips, endpoint, last_handshake, private_key, public_key, preshared_key,
  bytes_received, bytes_sent, prev_bytes_received, prev_bytes_sent, bytes_received_rate, bytes_sent_rate,
  total_bytes_received, total_bytes_sent, remaining_days, remaining_traffic_bytes, last_day_check, connected_at,
  is_connected, is_enabled, server_id, peer_icon, created_at, updated_at
FROM vpn_users`)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`DROP TABLE vpn_users`)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`ALTER TABLE vpn_users__np RENAME TO vpn_users`)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_vpn_users_server_id ON vpn_users(server_id)`)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_vpn_users_is_connected ON vpn_users(is_connected)`)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_vpn_users_public_key ON vpn_users(public_key)`)
	if err != nil {
		return err
	}
	_, _ = tx.Exec(`PRAGMA foreign_keys = ON`)
	return tx.Commit()
}

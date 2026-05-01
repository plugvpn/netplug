package db

import "database/sql"

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
	return nil
}

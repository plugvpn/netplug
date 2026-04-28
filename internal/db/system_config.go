package db

import (
	"database/sql"
	"encoding/json"
	"errors"
)

type SystemConfig struct {
	ID              string
	IsSetupComplete bool
	VPNConfigJSON   []byte
}

func GetSystemConfig(db *sql.DB) (SystemConfig, error) {
	var cfg SystemConfig
	err := db.QueryRow(`
		SELECT id, is_setup_complete, COALESCE(vpn_configuration, '')
		FROM system_config
		ORDER BY created_at ASC
		LIMIT 1
	`).Scan(&cfg.ID, &cfg.IsSetupComplete, &cfg.VPNConfigJSON)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return SystemConfig{}, nil
		}
		return SystemConfig{}, err
	}
	return cfg, nil
}

func UpsertSystemConfig(db *sql.DB, isSetupComplete bool, vpnConfig any) error {
	if db == nil {
		return errors.New("db is nil")
	}
	b, err := json.Marshal(vpnConfig)
	if err != nil {
		return err
	}
	// single-row table semantics
	_, err = db.Exec(`
		INSERT INTO system_config (id, is_setup_complete, vpn_configuration)
		VALUES ('system', ?, ?)
		ON CONFLICT(id) DO UPDATE SET
		  is_setup_complete = excluded.is_setup_complete,
		  vpn_configuration = excluded.vpn_configuration,
		  updated_at = datetime('now')
	`, boolInt(isSetupComplete), string(b))
	return err
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}


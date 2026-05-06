package wireguard

import (
	"database/sql"
	"path/filepath"
	"strings"
)

// WriteAndApplyAll regenerates every active WireGuard config file and applies it to the kernel.
func WriteAndApplyAll(sqlDB *sql.DB, dataDir string, envFallbackIface string) error {
	if err := WriteWireGuardConfig(sqlDB, dataDir); err != nil {
		return err
	}
	return ApplyAllWireGuardConfigs(sqlDB, dataDir, envFallbackIface)
}

// ApplyAllWireGuardConfigs runs wg-quick / wg syncconf for each active WireGuard server row.
func ApplyAllWireGuardConfigs(sqlDB *sql.DB, dataDir string, envFallbackIface string) error {
	if sqlDB == nil {
		return nil
	}
	rows, err := sqlDB.Query(`
		SELECT config_path, wg_interface
		FROM vpn_servers
		WHERE protocol = 'wireguard' AND is_active = 1
		  AND config_path IS NOT NULL AND TRIM(config_path) <> ''
		ORDER BY id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var lastErr error
	for rows.Next() {
		var path string
		var iface sql.NullString
		if err := rows.Scan(&path, &iface); err != nil {
			lastErr = err
			continue
		}
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		if !filepath.IsAbs(path) {
			path = filepath.Join(dataDir, path)
		}
		ifn := envFallbackIface
		if iface.Valid && strings.TrimSpace(iface.String) != "" {
			ifn = strings.TrimSpace(iface.String)
		}
		if err := ApplyConfigFile(path, ifn); err != nil {
			lastErr = err
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return lastErr
}

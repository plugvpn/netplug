package wireguard

import (
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
)

type SetupConfig struct {
	ServerHost          string
	ServerPort          int
	ServerAddress       string
	ClientAddressRange  string
	DNS                 string
	MTU                 int
	PersistentKeepalive int
	AllowedIPs          string
	PreUp               string
	PreDown             string
	PostUp              string
	PostDown            string
	PrivateKey          string
	PublicKey           string
}

func ValidateSetupConfig(c SetupConfig) error {
	if strings.TrimSpace(c.ServerHost) == "" {
		return errors.New("server host is required")
	}
	if c.ServerPort < 1 || c.ServerPort > 65535 {
		return errors.New("server port must be between 1 and 65535")
	}
	if strings.TrimSpace(c.ServerAddress) == "" {
		return errors.New("server address is required")
	}
	if strings.TrimSpace(c.ClientAddressRange) == "" {
		return errors.New("client address range is required")
	}
	if strings.TrimSpace(c.DNS) == "" {
		return errors.New("DNS is required")
	}
	if strings.TrimSpace(c.AllowedIPs) == "" {
		return errors.New("allowed IPs is required")
	}
	if c.MTU < 576 || c.MTU > 65535 {
		return errors.New("MTU must be between 576 and 65535")
	}
	if c.PersistentKeepalive < 0 || c.PersistentKeepalive > 65535 {
		return errors.New("persistent keepalive must be between 0 and 65535")
	}
	if strings.TrimSpace(c.PrivateKey) == "" || strings.TrimSpace(c.PublicKey) == "" {
		return errors.New("server keypair is required")
	}
	return nil
}

func UpsertWireGuardServer(db *sql.DB, dataDir string, s SetupConfig) error {
	if db == nil {
		return errors.New("db is nil")
	}
	configPath := filepath.Join(dataDir, "wg0.conf")
	_, err := db.Exec(`
		INSERT INTO vpn_servers (id, name, protocol, host, port, config_path, is_active, private_key, public_key)
		VALUES ('wireguard', 'WireGuard Server', 'wireguard', ?, ?, ?, 1, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
		  name = excluded.name,
		  protocol = excluded.protocol,
		  host = excluded.host,
		  port = excluded.port,
		  config_path = excluded.config_path,
		  is_active = 1,
		  private_key = excluded.private_key,
		  public_key = excluded.public_key,
		  updated_at = datetime('now')
	`, s.ServerHost, s.ServerPort, configPath, s.PrivateKey, s.PublicKey)
	return err
}


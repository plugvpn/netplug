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

// CreateWireGuardInterface inserts an additional WireGuard server row (separate listen port, subnet, config file).
func CreateWireGuardInterface(db *sql.DB, dataDir, displayName, host string, port int, wgIface, serverTunnelCIDR, clientPoolCIDR, privKey, pubKey string) (serverID string, err error) {
	if db == nil {
		return "", errors.New("db is nil")
	}
	displayName = strings.TrimSpace(displayName)
	host = strings.TrimSpace(host)
	wgIface = strings.TrimSpace(wgIface)
	serverTunnelCIDR = strings.TrimSpace(serverTunnelCIDR)
	clientPoolCIDR = strings.TrimSpace(clientPoolCIDR)
	if displayName == "" {
		return "", errors.New("display name is required")
	}
	if host == "" {
		return "", errors.New("endpoint host is required")
	}
	if port < 1 || port > 65535 {
		return "", errors.New("listen port must be between 1 and 65535")
	}
	if err := ValidateWGInterfaceName(wgIface); err != nil {
		return "", err
	}
	if serverTunnelCIDR == "" || clientPoolCIDR == "" {
		return "", errors.New("server tunnel address and client IP pool are required")
	}
	privKey = strings.TrimSpace(privKey)
	pubKey = strings.TrimSpace(pubKey)
	if privKey == "" {
		privKey, pubKey, err = GenerateKeyPair()
		if err != nil {
			return "", err
		}
	} else {
		derived, err := DerivePublicKey(privKey)
		if err != nil {
			return "", errors.New("invalid server private key")
		}
		if pubKey == "" {
			pubKey = derived
		} else if pubKey != derived {
			return "", errors.New("server public key mismatch")
		}
	}

	serverID = NewID()
	confPath := filepath.Join(dataDir, serverID+".conf")

	_, err = db.Exec(`
		INSERT INTO vpn_servers (
		  id, name, protocol, host, port, config_path, is_active,
		  private_key, public_key, wg_interface, wg_server_address, wg_client_range
		)
		VALUES (?, ?, 'wireguard', ?, ?, ?, 1, ?, ?, ?, ?, ?)
	`, serverID, displayName, host, port, confPath, privKey, pubKey, wgIface, serverTunnelCIDR, clientPoolCIDR)
	if err != nil {
		return "", err
	}
	return serverID, nil
}

// ValidateWGInterfaceName checks a Linux WireGuard interface name (e.g. wg1).
func ValidateWGInterfaceName(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return errors.New("interface name is required")
	}
	if len(s) > 15 {
		return errors.New("interface name is too long")
	}
	for _, r := range s {
		ok := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-'
		if !ok {
			return errors.New("interface name may only contain letters, digits, hyphen, underscore")
		}
	}
	if !strings.HasPrefix(s, "wg") {
		return errors.New("interface name should start with wg (e.g. wg1)")
	}
	return nil
}

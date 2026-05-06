package wireguard

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"netplug-go/internal/db"
)

type wireGuardConfig struct {
	Enabled            bool   `json:"enabled"`
	ServerHost         string `json:"serverHost"`
	ServerPort         int    `json:"serverPort"`
	ServerAddress      string `json:"serverAddress"`
	ClientAddressRange string `json:"clientAddressRange"`
	DNS                string `json:"dns"`
	MTU                int    `json:"mtu"`
	PersistentKeepalive int   `json:"persistentKeepalive"`
	AllowedIPs         string `json:"allowedIps"`
	PreUp              string `json:"preUp"`
	PreDown            string `json:"preDown"`
	PostUp             string `json:"postUp"`
	PostDown           string `json:"postDown"`
}

type vpnConfiguration struct {
	WireGuard wireGuardConfig `json:"wireGuard"`
}

func WriteWireGuardConfig(sqlDB *sql.DB, dataDir string) error {
	if sqlDB == nil {
		return errors.New("db is nil")
	}
	sys, err := db.GetSystemConfig(sqlDB)
	if err != nil {
		return err
	}
	if len(sys.VPNConfigJSON) == 0 {
		return errors.New("vpn configuration not set")
	}
	var vc vpnConfiguration
	if err := json.Unmarshal(sys.VPNConfigJSON, &vc); err != nil {
		return err
	}
	if !vc.WireGuard.Enabled {
		return errors.New("wireguard not enabled")
	}

	rows, err := sqlDB.Query(`
		SELECT id, config_path, COALESCE(port, 0), IFNULL(TRIM(private_key), ''),
		       wg_server_address
		FROM vpn_servers
		WHERE protocol = 'wireguard' AND is_active = 1
		ORDER BY id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			srvID                              string
			configPath, serverPriv, wgSrvAddr sql.NullString
			listenPort                         int
		)
		if err := rows.Scan(&srvID, &configPath, &listenPort, &serverPriv, &wgSrvAddr); err != nil {
			return err
		}
		id := strings.TrimSpace(srvID)
		if id == "" || !serverPriv.Valid || strings.TrimSpace(serverPriv.String) == "" {
			continue
		}
		if listenPort == 0 {
			listenPort = vc.WireGuard.ServerPort
		}

		serverAddr := strings.TrimSpace(wgSrvAddr.String)
		if serverAddr == "" {
			if id == "wireguard" {
				serverAddr = vc.WireGuard.ServerAddress
			} else {
				continue
			}
		}
		if !strings.Contains(serverAddr, "/") {
			if net.ParseIP(serverAddr) != nil && strings.Count(serverAddr, ".") == 3 {
				serverAddr = serverAddr + "/24"
			}
		}

		path := strings.TrimSpace(configPath.String)
		if path == "" {
			if id == "wireguard" {
				path = filepath.Join(dataDir, "wg0.conf")
			} else {
				path = filepath.Join(dataDir, id+".conf")
			}
		} else if !filepath.IsAbs(path) {
			path = filepath.Join(dataDir, path)
		}

		if err := writeWireGuardServerConfigFile(sqlDB, &vc, id, path, strings.TrimSpace(serverPriv.String), listenPort, serverAddr); err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return nil
}

func writeWireGuardServerConfigFile(sqlDB *sql.DB, vc *vpnConfiguration, serverID, path, serverPriv string, listenPort int, serverAddr string) error {
	var buf bytes.Buffer

	generatedAt := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	buf.WriteString("# WireGuard Server Configuration\n")
	buf.WriteString("# Generated at: " + generatedAt + "\n")
	buf.WriteString("# DO NOT EDIT MANUALLY - This file is auto-generated\n")
	buf.WriteString("# Instance: " + serverID + "\n\n")

	buf.WriteString("[Interface]\n")
	buf.WriteString(fmt.Sprintf("PrivateKey = %s\n", serverPriv))
	buf.WriteString(fmt.Sprintf("ListenPort = %d\n", listenPort))
	buf.WriteString(fmt.Sprintf("Address = %s\n", serverAddr))
	if strings.TrimSpace(vc.WireGuard.DNS) != "" {
		buf.WriteString(fmt.Sprintf("DNS = %s\n", vc.WireGuard.DNS))
	}
	if vc.WireGuard.MTU > 0 {
		buf.WriteString("\n# MTU Configuration\n")
		buf.WriteString(fmt.Sprintf("MTU = %d\n", vc.WireGuard.MTU))
	}
	writeHook(&buf, "PreUp", vc.WireGuard.PreUp)
	writeHook(&buf, "PostUp", vc.WireGuard.PostUp)
	writeHook(&buf, "PreDown", vc.WireGuard.PreDown)
	writeHook(&buf, "PostDown", vc.WireGuard.PostDown)
	buf.WriteString("\n")

	type peerRow struct {
		Username     string
		PublicKey    string
		PresharedKey sql.NullString
		AllowedIPs   sql.NullString
	}
	prows, err := sqlDB.Query(`
		SELECT username, public_key, preshared_key, allowed_ips
		FROM vpn_users
		WHERE server_id = ? AND is_enabled = 1 AND public_key IS NOT NULL AND public_key <> ''
		ORDER BY username ASC
	`, serverID)
	if err != nil {
		return err
	}
	defer prows.Close()

	var peers []peerRow
	for prows.Next() {
		var p peerRow
		if err := prows.Scan(&p.Username, &p.PublicKey, &p.PresharedKey, &p.AllowedIPs); err != nil {
			return err
		}
		peers = append(peers, p)
	}
	if err := prows.Err(); err != nil {
		return err
	}
	sort.Slice(peers, func(i, j int) bool { return peers[i].Username < peers[j].Username })

	buf.WriteString("# ========== Client Peers ==========\n\n")
	for _, p := range peers {
		if !p.AllowedIPs.Valid || strings.TrimSpace(p.AllowedIPs.String) == "" {
			continue
		}
		buf.WriteString(fmt.Sprintf("# User: %s\n", p.Username))
		buf.WriteString("[Peer]\n")
		buf.WriteString(fmt.Sprintf("PublicKey = %s\n", p.PublicKey))
		if p.PresharedKey.Valid && strings.TrimSpace(p.PresharedKey.String) != "" {
			buf.WriteString(fmt.Sprintf("PresharedKey = %s\n", p.PresharedKey.String))
		}
		buf.WriteString(fmt.Sprintf("AllowedIPs = %s\n", p.AllowedIPs.String))
		if vc.WireGuard.PersistentKeepalive > 0 {
			buf.WriteString(fmt.Sprintf("PersistentKeepalive = %d\n", vc.WireGuard.PersistentKeepalive))
		}
		buf.WriteString("\n")
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, buf.Bytes(), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func writeHook(buf *bytes.Buffer, key string, value string) {
	v := strings.TrimSpace(value)
	if v == "" {
		return
	}
	// wg-quick allows multiple commands separated by ';'. Preserve multiline as-is.
	lines := strings.Split(v, "\n")
	for _, ln := range lines {
		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}
		buf.WriteString(fmt.Sprintf("%s = %s\n", key, ln))
	}
}


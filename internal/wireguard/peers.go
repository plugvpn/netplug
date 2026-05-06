package wireguard

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"sort"
	"strings"

	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"

	"netplug-go/internal/db"
)

func GeneratePresharedKey() (string, error) {
	k, err := wgtypes.GenerateKey()
	if err != nil {
		return "", err
	}
	return k.String(), nil
}

func NextClientAllowedIP(sqlDB *sql.DB) (string, error) {
	return NextClientAllowedIPForServer(sqlDB, "wireguard")
}

// NextClientAllowedIPForServer picks the next free /32 inside the client pool for the given WireGuard server row.
func NextClientAllowedIPForServer(sqlDB *sql.DB, serverID string) (string, error) {
	serverID = strings.TrimSpace(serverID)
	if serverID == "" {
		return "", errors.New("server id is required")
	}
	sys, err := db.GetSystemConfig(sqlDB)
	if err != nil {
		return "", err
	}
	if len(sys.VPNConfigJSON) == 0 {
		return "", errors.New("vpn configuration not set")
	}

	var vc struct {
		WireGuard struct {
			ClientAddressRange string `json:"clientAddressRange"`
			ServerAddress      string `json:"serverAddress"`
		} `json:"wireGuard"`
	}
	if err := json.Unmarshal(sys.VPNConfigJSON, &vc); err != nil {
		return "", err
	}

	var wgClientRange, wgServerAddr sql.NullString
	err = sqlDB.QueryRow(`
		SELECT wg_client_range, wg_server_address FROM vpn_servers WHERE id = ? LIMIT 1
	`, serverID).Scan(&wgClientRange, &wgServerAddr)
	if err != nil {
		return "", err
	}

	clientRangeStr := strings.TrimSpace(wgClientRange.String)
	if !wgClientRange.Valid || clientRangeStr == "" {
		clientRangeStr = strings.TrimSpace(vc.WireGuard.ClientAddressRange)
	}
	if clientRangeStr == "" {
		return "", errors.New("client address range is not configured for this interface")
	}

	_, cidr, err := net.ParseCIDR(clientRangeStr)
	if err != nil {
		return "", errors.New("invalid client CIDR")
	}

	serverAddrForReserve := strings.TrimSpace(vc.WireGuard.ServerAddress)
	if wgServerAddr.Valid && strings.TrimSpace(wgServerAddr.String) != "" {
		serverAddrForReserve = strings.TrimSpace(wgServerAddr.String)
	}
	serverIP := parseServerIPv4(serverAddrForReserve)

	used := map[string]bool{}
	rows, err := sqlDB.Query(`SELECT allowed_ips FROM vpn_users WHERE server_id = ? AND allowed_ips IS NOT NULL AND allowed_ips <> ''`, serverID)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return "", err
		}
		ip := firstIPv4InAllowedIPs(s)
		if ip != nil {
			used[ip.String()] = true
		}
	}

	candidates := allHostsIPv4(cidr)
	sort.Slice(candidates, func(i, j int) bool { return bytesLess(candidates[i], candidates[j]) })
	for _, ip := range candidates {
		if serverIP != nil && ip.Equal(serverIP) {
			continue
		}
		if used[ip.String()] {
			continue
		}
		return fmt.Sprintf("%s/32", ip.String()), nil
	}
	return "", errors.New("no available IPs in subnet")
}

func parseServerIPv4(serverAddress string) net.IP {
	s := strings.TrimSpace(serverAddress)
	if s == "" {
		return nil
	}
	// Address may contain multiple entries separated by comma.
	if i := strings.IndexByte(s, ','); i >= 0 {
		s = strings.TrimSpace(s[:i])
	}
	if s == "" {
		return nil
	}
	// Common form is CIDR (e.g. 10.0.0.1/24).
	if strings.Contains(s, "/") {
		ip, _, err := net.ParseCIDR(s)
		if err == nil {
			return ip.To4()
		}
		// Fall back to stripping the suffix.
		s = strings.TrimSpace(strings.SplitN(s, "/", 2)[0])
	}
	return net.ParseIP(s).To4()
}

func firstIPv4InAllowedIPs(s string) net.IP {
	parts := strings.Split(s, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		ipStr := p
		if strings.Contains(p, "/") {
			ipStr = strings.SplitN(p, "/", 2)[0]
		}
		ip := net.ParseIP(ipStr).To4()
		if ip != nil {
			return ip
		}
	}
	return nil
}

func allHostsIPv4(cidr *net.IPNet) []net.IP {
	base := cidr.IP.To4()
	if base == nil {
		return nil
	}
	mask := cidr.Mask
	network := base.Mask(mask)
	// brute-force for /24 and smaller networks; good enough for this app.
	ones, bits := mask.Size()
	hostBits := bits - ones
	if hostBits <= 0 || hostBits > 16 {
		// avoid insane loops; require /16-/32 basically
		return nil
	}
	total := 1 << hostBits
	var out []net.IP
	for i := 1; i < total-1; i++ { // skip network and broadcast
		ip := make(net.IP, 4)
		copy(ip, network)
		addToIPv4(ip, i)
		if cidr.Contains(ip) {
			out = append(out, ip)
		}
	}
	return out
}

func addToIPv4(ip net.IP, n int) {
	v := (int(ip[0]) << 24) | (int(ip[1]) << 16) | (int(ip[2]) << 8) | int(ip[3])
	v += n
	ip[0] = byte(v >> 24)
	ip[1] = byte(v >> 16)
	ip[2] = byte(v >> 8)
	ip[3] = byte(v)
}

func bytesLess(a, b net.IP) bool {
	av := (uint32(a[0]) << 24) | (uint32(a[1]) << 16) | (uint32(a[2]) << 8) | uint32(a[3])
	bv := (uint32(b[0]) << 24) | (uint32(b[1]) << 16) | (uint32(b[2]) << 8) | uint32(b[3])
	return av < bv
}


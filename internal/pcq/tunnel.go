package pcq

import (
	"net"
	"strings"
)

// FirstTunnelIPCIDR mirrors the app's allowed_ips convention: primary tunnel is the segment before first comma.
func FirstTunnelIPCIDR(allowedIPs string) string {
	s := strings.TrimSpace(allowedIPs)
	if s == "" {
		return ""
	}
	if i := strings.IndexByte(s, ','); i >= 0 {
		s = strings.TrimSpace(s[:i])
	}
	return s
}

// TunnelIPv4 returns dotted IPv4 for the primary tunnel segment, or empty.
func TunnelIPv4(allowedIPs string) string {
	s := strings.TrimSpace(FirstTunnelIPCIDR(allowedIPs))
	if s == "" {
		return ""
	}
	if strings.Contains(s, "/") {
		host, _, err := net.ParseCIDR(s)
		if err != nil || host == nil || host.To4() == nil {
			return ""
		}
		return host.To4().String()
	}
	ip := net.ParseIP(s).To4()
	if ip == nil {
		return ""
	}
	return ip.String()
}

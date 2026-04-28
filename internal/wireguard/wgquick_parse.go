package wireguard

import (
	"bufio"
	"errors"
	"io"
	"net"
	"strconv"
	"strings"
)

type WGQuickInterface struct {
	PrivateKey  string
	ListenPort  int
	Address     string
	DNS         string
	MTU         int
	PreUp       string
	PostUp      string
	PreDown     string
	PostDown    string
	OtherKV     map[string]string
}

type WGQuickPeer struct {
	Username     string
	PublicKey    string
	PresharedKey string
	AllowedIPs   string
	Endpoint     string
	OtherKV      map[string]string
}

type WGQuickConfig struct {
	Interface WGQuickInterface
	Peers     []WGQuickPeer
}

// ParseWGQuickConfig parses a wg-quick style config.
// It understands [Interface], [Peer] sections and extracts "# User: <name>" comments for peer usernames.
func ParseWGQuickConfig(r io.Reader) (WGQuickConfig, error) {
	var out WGQuickConfig
	out.Interface.OtherKV = map[string]string{}

	sc := bufio.NewScanner(r)
	// Allow larger configs (many peers).
	const maxLine = 1024 * 1024
	sc.Buffer(make([]byte, 0, 64*1024), maxLine)

	section := ""
	var pendingUser string
	var curPeer *WGQuickPeer

	flushPeer := func() {
		if curPeer == nil {
			return
		}
		if curPeer.OtherKV == nil {
			curPeer.OtherKV = map[string]string{}
		}
		out.Peers = append(out.Peers, *curPeer)
		curPeer = nil
	}

	for sc.Scan() {
		raw := sc.Text()
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}

		// Comments
		if strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			// Keep looking for "# User: name"
			if u, ok := parseUserComment(line); ok {
				pendingUser = u
			}
			continue
		}

		// Section header
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			name := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(line, "["), "]"))
			name = strings.ToLower(name)
			if name == "peer" {
				flushPeer()
				p := WGQuickPeer{Username: strings.TrimSpace(pendingUser), OtherKV: map[string]string{}}
				curPeer = &p
				pendingUser = ""
				section = "peer"
				continue
			}
			if name == "interface" {
				flushPeer()
				section = "interface"
				continue
			}
			// Unknown section; treat as "other"
			flushPeer()
			section = name
			continue
		}

		key, val, ok := parseKV(line)
		if !ok {
			continue
		}

		switch section {
		case "interface":
			applyInterfaceKV(&out.Interface, key, val)
		case "peer":
			if curPeer == nil {
				p := WGQuickPeer{Username: strings.TrimSpace(pendingUser), OtherKV: map[string]string{}}
				curPeer = &p
				pendingUser = ""
			}
			applyPeerKV(curPeer, key, val)
		default:
			// ignore
		}
	}
	if err := sc.Err(); err != nil {
		return WGQuickConfig{}, err
	}
	flushPeer()

	if strings.TrimSpace(out.Interface.PrivateKey) == "" {
		return WGQuickConfig{}, errors.New("wg0.conf missing Interface PrivateKey")
	}
	return out, nil
}

func parseUserComment(line string) (string, bool) {
	ln := strings.TrimSpace(strings.TrimPrefix(line, "#"))
	ln = strings.TrimSpace(strings.TrimPrefix(ln, ";"))
	if ln == "" {
		return "", false
	}
	low := strings.ToLower(ln)
	const prefix = "user:"
	if !strings.HasPrefix(low, prefix) {
		return "", false
	}
	u := strings.TrimSpace(ln[len(prefix):])
	if u == "" {
		return "", false
	}
	return u, true
}

func parseKV(line string) (key string, value string, ok bool) {
	i := strings.IndexByte(line, '=')
	if i < 0 {
		return "", "", false
	}
	key = strings.TrimSpace(line[:i])
	value = strings.TrimSpace(line[i+1:])
	if key == "" {
		return "", "", false
	}
	return strings.ToLower(key), value, true
}

func applyInterfaceKV(intf *WGQuickInterface, key string, val string) {
	switch strings.ToLower(key) {
	case "privatekey":
		intf.PrivateKey = strings.TrimSpace(val)
	case "listenport":
		if n, err := strconv.Atoi(strings.TrimSpace(val)); err == nil && n > 0 && n <= 65535 {
			intf.ListenPort = n
		}
	case "address":
		intf.Address = strings.TrimSpace(val)
	case "dns":
		intf.DNS = strings.TrimSpace(val)
	case "mtu":
		if n, err := strconv.Atoi(strings.TrimSpace(val)); err == nil && n > 0 {
			intf.MTU = n
		}
	case "preup":
		intf.PreUp = appendHookLine(intf.PreUp, val)
	case "postup":
		intf.PostUp = appendHookLine(intf.PostUp, val)
	case "predown":
		intf.PreDown = appendHookLine(intf.PreDown, val)
	case "postdown":
		intf.PostDown = appendHookLine(intf.PostDown, val)
	default:
		if intf.OtherKV == nil {
			intf.OtherKV = map[string]string{}
		}
		intf.OtherKV[key] = val
	}
}

func applyPeerKV(p *WGQuickPeer, key string, val string) {
	switch strings.ToLower(key) {
	case "publickey":
		p.PublicKey = strings.TrimSpace(val)
	case "presharedkey":
		p.PresharedKey = strings.TrimSpace(val)
	case "allowedips":
		p.AllowedIPs = strings.TrimSpace(val)
	case "endpoint":
		p.Endpoint = strings.TrimSpace(val)
	default:
		if p.OtherKV == nil {
			p.OtherKV = map[string]string{}
		}
		p.OtherKV[key] = val
	}
}

func appendHookLine(existing string, next string) string {
	n := strings.TrimSpace(next)
	if n == "" {
		return existing
	}
	if strings.TrimSpace(existing) == "" {
		return n
	}
	return strings.TrimSpace(existing) + "\n" + n
}

func FirstPeerVPNIP(allowedIPs string) string {
	raw := strings.TrimSpace(allowedIPs)
	if raw == "" {
		return ""
	}
	if i := strings.IndexByte(raw, ','); i >= 0 {
		raw = strings.TrimSpace(raw[:i])
	}
	// Strip CIDR if present.
	ip := raw
	if slash := strings.IndexByte(ip, '/'); slash >= 0 {
		ip = strings.TrimSpace(ip[:slash])
	}
	if net.ParseIP(ip) == nil {
		return ""
	}
	return ip
}


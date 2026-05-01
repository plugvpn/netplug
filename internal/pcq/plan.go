package pcq

import (
	"database/sql"
	"fmt"
	"math"
	"sort"
	"strings"
)

// kbpsToRateSpec converts stored kb/s (1024 kb per Mbps from the UI) to an iproute tc rate literal.
func kbpsToRateSpec(kbps int) string {
	if kbps <= 0 {
		return ""
	}
	mbps := float64(kbps) / 1024.0
	bitPerSec := int64(math.Max(8000, math.Round(mbps*1e6)))
	return fmt.Sprintf("%dbit", bitPerSec)
}

func burstBytesPreferringConfig(burstKbps, rateKbps int) int {
	var fromRate int
	if rateKbps > 0 {
		mbps := float64(rateKbps) / 1024.0
		bitPerSec := mbps * 1e6
		fromRate = int(math.Max(1600, math.Round(bitPerSec/8.0*0.05)))
	}
	if burstKbps > 0 {
		mbpsBurst := float64(burstKbps) / 1024.0
		bitPerSec := mbpsBurst * 1e6
		fromBurst := int(math.Max(1600, math.Round(bitPerSec/8.0*0.05)))
		if fromRate > 0 && fromBurst > fromRate {
			return fromRate
		}
		return fromBurst
	}
	if fromRate > 0 {
		return fromRate
	}
	return 12500
}

// peerShapeAppend appends shaping-only tc argument vectors for peers (no qdisc teardown or root resets).
func peerShapeAppend(iface string, peers map[string]PeerLimit) [][]string {
	if peers == nil {
		peers = make(map[string]PeerLimit)
	}
	var cmds [][]string
	if iface == "" || len(peers) == 0 {
		return cmds
	}

	keys := make([]string, 0, len(peers))
	for ip := range peers {
		keys = append(keys, ip)
	}
	sort.Strings(keys)

	needsDL, needsUL := false, false
	for _, ip := range keys {
		pl := peers[ip]
		if pl.DownloadKbps > 0 {
			needsDL = true
		}
		if pl.UploadKbps > 0 {
			needsUL = true
		}
	}

	const rootCeil = "100000mbit"
	if needsDL {
		cmds = append(cmds, []string{"tc", "qdisc", "add", "dev", iface, "root", "handle", "1:", "htb", "default", "30"})
		cmds = append(cmds, []string{
			"tc", "class", "add", "dev", iface, "parent", "1:", "classid", "1:1", "htb",
			"rate", rootCeil, "ceil", rootCeil,
		})
		cmds = append(cmds, []string{
			"tc", "class", "add", "dev", iface, "parent", "1:1", "classid", "1:30", "htb",
			"rate", rootCeil, "ceil", rootCeil, "prio", "7",
		})
		fi := uint32(50)
		minor := uint32(100)
		for _, ip := range keys {
			pl := peers[ip]
			if pl.DownloadKbps <= 0 {
				continue
			}
			classStr := fmt.Sprintf("1:%x", minor)
			rateSpec := kbpsToRateSpec(pl.DownloadKbps)
			if rateSpec == "" {
				minor++
				continue
			}
			cl := []string{
				"tc", "class", "add", "dev", iface, "parent", "1:1", "classid", classStr,
				"htb", "rate", rateSpec, "ceil", rateSpec, "prio", "5",
			}
			if pl.BurstDownloadKbps > 0 {
				b := burstBytesPreferringConfig(pl.BurstDownloadKbps, pl.DownloadKbps)
				cl = append(cl, "burst", fmt.Sprintf("%d", b), "cburst", fmt.Sprintf("%d", b))
			}
			cmds = append(cmds, cl)
			cmds = append(cmds, []string{
				"tc", "filter", "add", "dev", iface, "protocol", "ip", "parent", "1:", "prio", fmt.Sprintf("%d", fi),
				"u32", "match", "ip", "dst", ip + "/32", "flowid", classStr,
			})
			fi++
			minor++
			if minor > 0xff00 {
				break
			}
		}
	}

	if needsUL {
		cmds = append(cmds, []string{"tc", "qdisc", "add", "dev", iface, "handle", "ffff:", "ingress"})
		pi := uint32(10)
		for _, ip := range keys {
			pl := peers[ip]
			if pl.UploadKbps <= 0 {
				continue
			}
			r := kbpsToRateSpec(pl.UploadKbps)
			if r == "" {
				continue
			}
			burst := burstBytesPreferringConfig(pl.BurstUploadKbps, pl.UploadKbps)
			cmds = append(cmds, []string{
				"tc", "filter", "add", "dev", iface, "parent", "ffff:", "protocol", "ip", "prio", fmt.Sprintf("%d", pi),
				"u32", "match", "ip", "src", ip + "/32",
				"police", "rate", r, "burst", fmt.Sprintf("%d", burst),
				"mtu", "1500",
				"conform-exceed", "drop",
			})
			pi++
		}
	}
	return cmds
}

// Plan returns shell-style tc argument vectors for a full apply (starts with teardown of existing netplug root/ingress).
func Plan(wgIface string, peers map[string]PeerLimit) [][]string {
	if peers == nil {
		peers = make(map[string]PeerLimit)
	}
	iface := strings.TrimSpace(wgIface)
	var cmds [][]string
	cmds = append(cmds, []string{"sh", "-c", "tc qdisc del dev " + iface + " ingress 2>/dev/null || true"})
	cmds = append(cmds, []string{"sh", "-c", "tc qdisc del dev " + iface + " root 2>/dev/null || true"})
	if iface == "" {
		return cmds
	}

	if len(peers) == 0 {
		return cmds
	}

	return append(cmds, peerShapeAppend(iface, peers)...)
}

// PlanForPeers returns shaping-only vectors for peers (omit iface-wide teardown), for UI previews scoped to one source of limits.
func PlanForPeers(wgIface string, peers map[string]PeerLimit) [][]string {
	return peerShapeAppend(strings.TrimSpace(wgIface), peers)
}

// PlanCommands loads peer limits then returns formatted command lines for display / logging.
func PlanCommands(db *sql.DB, wgIface string) ([]string, error) {
	m, err := LoadPeerLimits(db)
	if err != nil {
		return nil, err
	}
	return FormatPlan(Plan(wgIface, m)), nil
}

// PlanCommandsForGroup returns formatted tc lines for one group's preset and members only (not merged with other groups).
func PlanCommandsForGroup(db *sql.DB, wgIface, groupID string) ([]string, error) {
	var presetCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM vpn_group_pcq WHERE group_id = ?`, groupID).Scan(&presetCount); err != nil {
		return nil, err
	}
	if presetCount == 0 {
		return []string{
			"# No saved queue preset for this group yet.",
			"# Save Mbps caps below to preview shaping for this group's members only.",
			"#",
			"# Live apply still merges presets from every group when computing caps per tunnel peer.",
		}, nil
	}

	m, err := LoadPeerLimitsForGroup(db, groupID)
	if err != nil {
		return nil, err
	}
	if len(m) == 0 {
		return []string{
			"# This group's preset has no effective shaping lines yet:",
			"# set upload/download Mbps or ensure members use WireGuard with IPv4 tunnel addresses.",
		}, nil
	}

	iface := strings.TrimSpace(wgIface)
	if iface == "" {
		return []string{"# Configure a WireGuard interface name to preview interface-specific tc lines."}, nil
	}

	lines := FormatPlan(PlanForPeers(iface, m))
	if len(lines) == 0 {
		return []string{"# (No tc shaping lines for empty interface or limits.)"}, nil
	}
	return lines, nil
}

func FormatPlan(cmds [][]string) []string {
	lines := make([]string, 0, len(cmds)+2)
	for _, c := range cmds {
		line := quotedJoin(c)
		lines = append(lines, line)
	}
	return lines
}

func quotedJoin(args []string) string {
	var b strings.Builder
	for i, a := range args {
		if i > 0 {
			b.WriteByte(' ')
		}
		if strings.ContainsAny(a, " '\"&|;<>`$\n") || a == "" {
			b.WriteString(`'`)
			b.WriteString(strings.ReplaceAll(a, `'`, `'\''`))
			b.WriteString(`'`)
		} else {
			b.WriteString(a)
		}
	}
	return b.String()
}

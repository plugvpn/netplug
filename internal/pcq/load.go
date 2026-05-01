package pcq

import (
	"database/sql"
	"strings"
)

// PeerLimit is the effective bitrate cap(s) applied to outbound/inbound shaping for one tunnel IPv4.
type PeerLimit struct {
	DownloadKbps int
	UploadKbps   int
	// Optional burst knobs (Mbps↔stored kb/s same as elsewhere in the app). Used only when > 0.
	BurstDownloadKbps int
	BurstUploadKbps   int
}

func nz64(v sql.NullInt64) int {
	if !v.Valid || v.Int64 <= 0 {
		return 0
	}
	return int(v.Int64)
}

func classifyRow(dl, ul, bd, bu sql.NullInt64, clf string) (edl, eul, ebd, ebu int) {
	switch clf {
	case "dst-download":
		return nz64(dl), 0, nz64(bd), 0
	case "src-upload":
		return 0, nz64(ul), 0, nz64(bu)
	default:
		return nz64(dl), nz64(ul), nz64(bd), nz64(bu)
	}
}

func mergeMin(cur, add int) int {
	if add <= 0 {
		return cur
	}
	if cur <= 0 || add < cur {
		return add
	}
	return cur
}

// LoadPeerLimits returns map[tunnelIPv4]=merged limits across all groups where the user is an enabled WG peer.
func LoadPeerLimits(db *sql.DB) (map[string]PeerLimit, error) {
	rows, err := db.Query(`
		SELECT COALESCE(u.allowed_ips,''),
			p.download_limit_kbps,
			p.upload_limit_kbps,
			p.burst_download_kbps,
			p.burst_upload_kbps,
			IFNULL(TRIM(p.pcq_classifier),'dual')
		FROM vpn_users u
		INNER JOIN vpn_group_members m ON m.vpn_user_id = u.id
		INNER JOIN vpn_group_pcq p ON p.group_id = m.group_id
		WHERE u.server_id = 'wireguard' AND u.is_enabled = 1 AND p.is_disabled = 0
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]PeerLimit)
	for rows.Next() {
		var allowedIPs string
		var dl, ul, bd, bu sql.NullInt64
		var clf string
		if err := rows.Scan(&allowedIPs, &dl, &ul, &bd, &bu, &clf); err != nil {
			return nil, err
		}
		ip := TunnelIPv4(allowedIPs)
		if ip == "" {
			continue
		}
		edl, eul, ebd, ebu := classifyRow(dl, ul, bd, bu, clf)
		if edl <= 0 && eul <= 0 {
			continue
		}
		pl, ok := out[ip]
		if !ok {
			pl = PeerLimit{}
		}
		pl.DownloadKbps = mergeMin(pl.DownloadKbps, edl)
		pl.UploadKbps = mergeMin(pl.UploadKbps, eul)
		pl.BurstDownloadKbps = mergeMin(pl.BurstDownloadKbps, ebd)
		pl.BurstUploadKbps = mergeMin(pl.BurstUploadKbps, ebu)
		out[ip] = pl
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// LoadPeerLimitsForGroup returns merged limits using only vpn_group_members and vpn_group_pcq for groupID
// (this group's preset only—not merged with caps from other groups).
func LoadPeerLimitsForGroup(db *sql.DB, groupID string) (map[string]PeerLimit, error) {
	groupID = strings.TrimSpace(groupID)
	if groupID == "" {
		return map[string]PeerLimit{}, nil
	}

	rows, err := db.Query(`
		SELECT COALESCE(u.allowed_ips,''),
			p.download_limit_kbps,
			p.upload_limit_kbps,
			p.burst_download_kbps,
			p.burst_upload_kbps,
			IFNULL(TRIM(p.pcq_classifier),'dual')
		FROM vpn_users u
		INNER JOIN vpn_group_members m ON m.vpn_user_id = u.id AND m.group_id = ?
		INNER JOIN vpn_group_pcq p ON p.group_id = m.group_id
		WHERE u.server_id = 'wireguard' AND u.is_enabled = 1 AND p.is_disabled = 0
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]PeerLimit)
	for rows.Next() {
		var allowedIPs string
		var dl, ul, bd, bu sql.NullInt64
		var clf string
		if err := rows.Scan(&allowedIPs, &dl, &ul, &bd, &bu, &clf); err != nil {
			return nil, err
		}
		ip := TunnelIPv4(allowedIPs)
		if ip == "" {
			continue
		}
		edl, eul, ebd, ebu := classifyRow(dl, ul, bd, bu, clf)
		if edl <= 0 && eul <= 0 {
			continue
		}
		pl, ok := out[ip]
		if !ok {
			pl = PeerLimit{}
		}
		pl.DownloadKbps = mergeMin(pl.DownloadKbps, edl)
		pl.UploadKbps = mergeMin(pl.UploadKbps, eul)
		pl.BurstDownloadKbps = mergeMin(pl.BurstDownloadKbps, ebd)
		pl.BurstUploadKbps = mergeMin(pl.BurstUploadKbps, ebu)
		out[ip] = pl
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

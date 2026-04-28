//go:build !linux

package wireguard

func GetTunnelUptimeSeconds(live WireGuardLiveStatus) *int64 {
	return nil
}


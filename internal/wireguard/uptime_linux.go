//go:build linux

package wireguard

import (
	"os"
	"syscall"
	"time"
)

func GetTunnelUptimeSeconds(live WireGuardLiveStatus) *int64 {
	if !live.Up || live.InterfaceName == nil {
		return nil
	}
	fi, err := os.Stat("/sys/class/net/" + *live.InterfaceName)
	if err != nil {
		return nil
	}
	st, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return nil
	}
	sec := st.Ctim.Sec
	if sec <= 0 {
		return nil
	}
	u := time.Since(time.Unix(sec, 0))
	out := int64(u.Seconds())
	if out < 0 {
		return nil
	}
	return &out
}


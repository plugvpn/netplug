package pcq

import (
	"database/sql"
	"sync"
)

var applyMu sync.Mutex

// Apply rebuilds tc state on wgIface from vpn_group_pcq + memberships. When disabled, only removes netplug qdiscs.
func Apply(db *sql.DB, wgIface string, disabled bool) ([]string, error) {
	applyMu.Lock()
	defer applyMu.Unlock()

	var peers map[string]PeerLimit
	var err error
	if !disabled {
		peers, err = LoadPeerLimits(db)
		if err != nil {
			return nil, err
		}
	}
	if peers == nil {
		peers = make(map[string]PeerLimit)
	}

	cmds := Plan(wgIface, peers)
	lines := FormatPlan(cmds)
	if err := runCommands(cmds); err != nil {
		return lines, err
	}
	return lines, nil
}

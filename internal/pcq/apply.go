package pcq

import (
	"database/sql"
	"log/slog"
	"sync"
)

var applyMu sync.Mutex

// Apply rebuilds tc state on wgIface from vpn_group_pcq + memberships. When disabled, only removes netplug qdiscs.
func Apply(db *sql.DB, wgIface string, disabled bool, opts ApplyOpts) ([]string, error) {
	applyMu.Lock()
	defer applyMu.Unlock()

	if lg, ok := opts.log(); ok {
		lg.Info("netplug.pcq.apply.begin",
			slog.String("component", "pcq"),
			slog.String("wg_iface", wgIface),
			slog.Bool("disabled", disabled),
		)
	}

	var peers map[string]PeerLimit
	var err error
	if !disabled {
		peers, err = LoadPeerLimits(db)
		if err != nil {
			if lg, ok := opts.log(); ok {
				lg.Error("netplug.pcq.peers_load_failed",
					slog.String("component", "pcq"),
					slog.String("err", err.Error()),
				)
			}
			return nil, err
		}
	}
	if peers == nil {
		peers = make(map[string]PeerLimit)
	}

	if lg, ok := opts.log(); ok {
		nd, nu := summarizePeerDirections(peers)
		lg.Info("netplug.pcq.peers_resolved",
			slog.String("component", "pcq"),
			slog.Int("peer_count", len(peers)),
			slog.Bool("needs_download_shaping", nd),
			slog.Bool("needs_upload_shaping", nu),
			slog.Any("peers", peersApplyRecords(peers)),
		)
	}

	cmds := Plan(wgIface, peers)
	lines := FormatPlan(cmds)

	if lg, ok := opts.log(); ok {
		lg.Info("netplug.pcq.plan_built",
			slog.String("component", "pcq"),
			slog.Int("command_count", len(cmds)),
		)
	}

	if err := runCommands(cmds, opts); err != nil {
		if lg, ok := opts.log(); ok {
			lg.Error("netplug.pcq.exec_failed",
				slog.String("component", "pcq"),
				slog.String("err", err.Error()),
			)
		}
		return lines, err
	}

	if lg, ok := opts.log(); ok {
		lg.Info("netplug.pcq.apply_complete",
			slog.String("component", "pcq"),
			slog.Int("commands_executed", len(cmds)),
		)
	}
	return lines, nil
}

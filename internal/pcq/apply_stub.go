//go:build !linux

package pcq

import "log/slog"

func runCommands(cmds [][]string, opts ApplyOpts) error {
	if lg, ok := opts.log(); ok {
		for i, argv := range cmds {
			if len(argv) == 0 {
				continue
			}
			lg.Info("netplug.pcq.tc.command_skipped",
				slog.String("component", "pcq"),
				slog.String("reason", "non_linux_build"),
				slog.Int("index", i),
				slog.Any("argv", argv),
			)
		}
	}
	return nil
}

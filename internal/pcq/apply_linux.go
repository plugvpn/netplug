//go:build linux

package pcq

import (
	"bytes"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"time"
)

func runCommands(cmds [][]string, opts ApplyOpts) error {
	lg, debug := opts.log()
	for i, argv := range cmds {
		if len(argv) == 0 {
			continue
		}
		if debug {
			lg.Info("netplug.pcq.tc.command",
				slog.String("component", "pcq"),
				slog.String("phase", "start"),
				slog.Int("index", i),
				slog.Any("argv", argv),
			)
		}
		start := time.Now()
		c := exec.Command(argv[0], argv[1:]...)
		var buf bytes.Buffer
		c.Stderr = &buf
		c.Stdout = &buf
		err := c.Run()
		out := strings.TrimSpace(buf.String())
		if debug {
			args := []any{
				slog.String("component", "pcq"),
				slog.String("phase", "done"),
				slog.Int("index", i),
				slog.String("program", argv[0]),
				slog.Duration("duration", time.Since(start)),
				slog.Bool("ok", err == nil),
			}
			if out != "" {
				args = append(args, slog.String("output", out))
			}
			if err != nil {
				args = append(args, slog.String("exec_err", err.Error()))
			}
			lg.Info("netplug.pcq.tc.command", args...)
		}
		if err != nil {
			return fmt.Errorf("%s: %w: %s", argv[0], err, out)
		}
	}
	return nil
}

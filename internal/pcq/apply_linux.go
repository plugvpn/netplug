//go:build linux

package pcq

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

func runCommands(cmds [][]string) error {
	for _, argv := range cmds {
		if len(argv) == 0 {
			continue
		}
		c := exec.Command(argv[0], argv[1:]...)
		var buf bytes.Buffer
		c.Stderr = &buf
		c.Stdout = &buf
		if err := c.Run(); err != nil {
			return fmt.Errorf("%s: %w: %s", argv[0], err, strings.TrimSpace(buf.String()))
		}
	}
	return nil
}

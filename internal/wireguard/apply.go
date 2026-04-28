package wireguard

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

func ApplyConfig(dataDir string, configuredInterface string) error {
	confPath := filepath.Join(dataDir, "wg0.conf")
	if _, err := os.Stat(confPath); err != nil {
		return err
	}

	// If interface exists, prefer syncconf to avoid disconnects.
	ifaces, _ := execOut("wg", "show", "interfaces")
	actual := pickInterface(ifaces, configuredInterface)
	if actual != "" {
		return syncconf(actual, confPath)
	}
	// Else bring up.
	_, err := execOutTimeout(180*time.Second, "wg-quick", "up", confPath)
	return err
}

func syncconf(iface string, confPath string) error {
	// `wg syncconf` expects a config without [Interface]; simplest is to call `wg-quick strip`.
	out, err := execOutTimeout(30*time.Second, "wg-quick", "strip", confPath)
	if err != nil {
		return err
	}
	tmp := confPath + ".peers.tmp"
	if err := os.WriteFile(tmp, []byte(out), 0o600); err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp) }()
	_, err = execOutTimeout(30*time.Second, "wg", "syncconf", iface, tmp)
	if err != nil {
		return err
	}
	return nil
}

func pickInterface(raw string, preferred string) string {
	parts := strings.Fields(strings.TrimSpace(raw))
	if len(parts) == 0 {
		return ""
	}
	for _, p := range parts {
		if p == preferred {
			return p
		}
	}
	// macOS often maps wg0 -> utunX; pick first.
	return parts[0]
}

func execOut(name string, args ...string) (string, error) {
	return execOutTimeout(10*time.Second, name, args...)
}

func execOutTimeout(timeout time.Duration, name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.Env = os.Environ()
	b, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = err.Error()
		}
		return "", errors.New(msg)
	}
	return string(b), nil
}


package app

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
)

type Config struct {
	HTTPAddr     string
	DataDir      string
	DBPath       string
	CookieSecure bool
	WGInterface  string
	WGInterval   int // seconds

	ProjectRoot string
}

func LoadConfig() (Config, error) {
	root, err := os.Getwd()
	if err != nil {
		return Config{}, err
	}

	httpAddr := env("HTTP_ADDR", ":8080")
	dataDir := env("DATA_DIR", filepath.Join(root, "sandbox", "data"))
	dbPath := env("SQLITE_PATH", filepath.Join(dataDir, "netplug.sqlite"))

	cookieSecure := false
	if v := os.Getenv("COOKIE_SECURE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, errors.New("COOKIE_SECURE must be true/false")
		}
		cookieSecure = b
	}

	wgIface := env("WG_INTERFACE", "wg0")
	wgInterval := 30
	if v := os.Getenv("WIREGUARD_SYNC_INTERVAL_SEC"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			return Config{}, errors.New("WIREGUARD_SYNC_INTERVAL_SEC must be a positive integer")
		}
		wgInterval = n
	}

	return Config{
		HTTPAddr:     httpAddr,
		DataDir:      dataDir,
		DBPath:       dbPath,
		CookieSecure: cookieSecure,
		WGInterface:  wgIface,
		WGInterval:   wgInterval,
		ProjectRoot:  root,
	}, nil
}

func (c Config) DatabaseDSN() string {
	// mattn/go-sqlite3 DSN with pragmas.
	// WAL + busy_timeout keeps the UI snappy while sync writes happen.
	return c.DBPath + "?_busy_timeout=5000&_journal_mode=WAL&_foreign_keys=on"
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}


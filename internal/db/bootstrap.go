package db

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// BootstrapAdmin creates an initial admin user if:
// - the users table is empty
// - BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD are set
//
// This is intentionally explicit to avoid silently creating default credentials.
func BootstrapAdmin(db *sql.DB) error {
	if db == nil {
		return errors.New("db is nil")
	}

	username := strings.TrimSpace(os.Getenv("BOOTSTRAP_ADMIN_USERNAME"))
	password := os.Getenv("BOOTSTRAP_ADMIN_PASSWORD")
	if username == "" || password == "" {
		return nil
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		return err
	}
	if n != 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}

	_, err = db.Exec(
		`INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, 'admin')`,
		uuid.NewString(),
		username,
		string(hash),
	)
	if err != nil {
		return err
	}

	fmt.Fprintf(os.Stderr, "bootstrapped admin user %q\n", username)
	return nil
}


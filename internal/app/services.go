package app

import (
	"database/sql"
	"time"

	"github.com/alexedwards/scs/v2"
)

type Services struct {
	DB       *sql.DB
	Sessions *scs.SessionManager
	Config   Config

	StartedAt time.Time
}


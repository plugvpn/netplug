package app

import (
	"database/sql"
	"log/slog"
	"time"

	"github.com/alexedwards/scs/v2"
)

type Services struct {
	DB       *sql.DB
	Sessions *scs.SessionManager
	Config   Config
	Logger   *slog.Logger // set when NETPLUG_DEBUG JSON logging is enabled

	StartedAt time.Time
}
